/* eslint no-continue: 0 */

import Handsontable from 'handsontable'
import CellErrorsManager from './cell-errors-manager'
import ChoicesDropdown from './choices-dropdown'
import {
  executePotentialFn,
  getVisualRowAndColForCellProperties,
  isEmptyString,
} from './utils'

const { TextEditor } = Handsontable.editors
const {
  addClass, removeClass, hasClass,
} = Handsontable.dom
const { KEY_CODES, rangeEach } = Handsontable.helper

const DEFAULT_SEPARATOR = ';'

const HOOK_CALLBACKS = {
  beforeKeyDown (event) {
    this.onBeforeKeyDown(event)
  },
  explicitKeydown ({ event }) {
    this.onBeforeKeyDown(event)
  },
}

const EDITOR_HIDDEN_CLASS_NAME = 'ht_editor_hidden'
const EDITOR_VISIBLE_CLASS_NAME = 'ht_editor_visible'
const CELL_CLASS_NAME = 'multi-select__cell'
const CELL_CONTENT_CLASS_NAME = 'multi-select__cell-content'
const CELL_CONTENT_VALUE_CLASS_NAME = 'multi-select__cell-content-value'
const CELL_DISABLED_CLASS_NAME = 'multi-select__cell--disabled'
const CELL_ERROR_POPUP_CLASS_NAME = 'multi-select__cell-errorpopup'

export class MultiSelectEditor extends TextEditor {
  /**
   * Gets current value from editable element.
   *
   * @return {string}
   */
  getValue () {
    return this.choices.getValue().join(this.separator)
  }

  /**
   * Creates an editor's elements and adds necessary CSS classnames.
   */
  createElements () {
    // Create textarea and parent
    this.TEXTAREA_PARENT = document.createElement('div')
    this.TEXTAREA = document.createElement('select')
    this.TEXTAREA.select = () => null
    this.TEXTAREA.style.display = 'none'

    addClass(this.TEXTAREA, 'handsontableInput')
    addClass(this.TEXTAREA_PARENT, 'handsontableInputHolder')
    addClass(this.TEXTAREA_PARENT, 'multi-select')
    addClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)

    this.textareaStyle = this.TEXTAREA.style
    this.textareaParentStyle = this.TEXTAREA_PARENT.style

    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA)
    this.instance.rootElement.appendChild(this.TEXTAREA_PARENT)
    this.textareaParentStyle.display = 'none'

    this.choices = new ChoicesDropdown(this.TEXTAREA)
    this.choices.renderStructure()

    this.choices.addEventListener('change', ({ isMultiple, actionType }) => {
      if (!isMultiple && actionType === 'add' && this.isOpened()) {
        this.instance.destroyEditor()
        this.focusCurrentCell()
      }
    })

    this.cellErrorsManager = new CellErrorsManager(this.instance)

    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))

    // Adds default handsontable support: allow for the input to be blurred
    // and blur after the send ESCAPE press.
    // NOTE: This handler won't be triggered when search
    // input is focused (because of some kind of handsontable event override).
    document.addEventListener('keydown', (event) => {
      if (event.keyCode === KEY_CODES.ESCAPE && this.isOpened()) {
        this.instance.destroyEditor()
      }
    })
  }

  /**
   * Prepares editor's meta data.
   */
  prepare (row, col, prop, td, originalValue, cellProperties) {
    super.prepare(row, col, prop, td, originalValue, cellProperties)

    const { type } = cellProperties

    this.selectOptions = cellProperties?.select ?? {}
    const config = this.selectOptions?.config

    this.type = type
    this.separator = config?.separator ?? DEFAULT_SEPARATOR

    const { valueKey = 'key', labelKey = 'value', isMultiple = true } = config || {}
    this.valueKey = valueKey
    this.labelKey = labelKey

    this.choices.reset()
    this.choices.isMultiple = isMultiple

    const values = !cellProperties.currentError
      ? originalValue?.toString().split(this.separator).filter(Boolean)
      : []

    this.choices.setValues(values)

    this.textareaParentStyle.width = `${this.getEditedCell().getBoundingClientRect().width}px`
    this.lastCellInfo = {
      row, col, prop, td, originalValue, cellProperties,
    }

    // Handles keyboard events when the search is blurred
    this.instance.addHookOnce('beforeKeyDown', HOOK_CALLBACKS.beforeKeyDown.bind(this))

    // Sets an error if the pasted/injected value is invalid.
    this.instance.addHook('afterChange', async (changesPromise) => {
      const changes = await changesPromise ?? []

      // eslint-disable-next-line no-restricted-syntax
      for await (const change of changes) {
        if (!change) continue

        const [ oldValueRaw, newValueRaw ] = change.slice(-2)
        if (oldValueRaw === newValueRaw) continue

        // NOTE: Need to manually fetch meta, as multiple cells
        // could be changed at once. The "this.cellProperties" contains
        // information only about the cell in focus.
        const [ visualRow, visualColumn ] = change
        const updatedCellProps = this.instance.getCellMeta(visualRow, visualColumn)

        // Prevents irrelevant cells to be checked/modified.
        const cellEditor = updatedCellProps.editor
        const columnEditor = this.instance.getSettings()
          .columns[this.instance.propToCol(visualColumn)]?.editor
        const usedEditor = cellEditor ?? columnEditor

        if (usedEditor?.name !== MultiSelectEditor.name) continue

        // Gets the value the cell was updated to.
        const updatedValue = change?.slice(-1)[0]?.toString().trim()
        if (isEmptyString(updatedValue)) {
          this.cellErrorsManager.dismissErrorForCell(updatedCellProps)
          continue
        }

        // Gets available options
        const optionsFn = this.selectOptions?.options ?? null
        const options = await executePotentialFn(optionsFn, updatedCellProps, originalValue)
        if (!options) continue

        // Gets all available label options
        const itemLabelKey = this.selectOptions?.config?.labelKey ?? 'value'
        const availableLabels = options.map((l) => l[itemLabelKey]?.toString().trim())

        const selectOptions = cellProperties?.select?.config
        if (!selectOptions) continue

        const isValid = selectOptions.isMultiple === false
          ? availableLabels.includes(updatedValue)
          : !updatedValue.split(selectOptions.separator ?? DEFAULT_SEPARATOR)
            .some((l) => !availableLabels.includes(l))

        // Displays an error if the "updatedValue"
        // does not align with the available options.
        if (!isValid) {
          this.cellErrorsManager.throwErrorForCell(
            'The value is unknown.',
            updatedCellProps
          )

          continue
        }

        this.cellErrorsManager.dismissErrorForCell(updatedCellProps)
      }
    })

    // Handles keyboard events when search input is selected
    this.choices.setEventListener('explicitKeydown', HOOK_CALLBACKS.explicitKeydown.bind(this))
  }

  /**
   * Opens the editor and adjusts its size.
   */
  open () {
    if (this.selectOptions?.readOnly) return

    // Resets the value upon opening, if the cell is errored.
    if (this.cellProperties.currentError) {
      const { row, col } = getVisualRowAndColForCellProperties(this.cellProperties, this.instance)

      this.cellErrorsManager.dismissErrorForCell(this.cellProperties)
      this.instance.setDataAtCell(row, col, null)
    }

    this.choices.setOptions(this.selectOptions.options, {
      key: this.valueKey, value: this.labelKey,
    }, this.lastCellInfo)

    this.refreshDimensions()
    this.choices.show(this.TD)
  }

  /**
   * Closes the editor.
   */
  close () {
    if (this.selectOptions?.readOnly) return

    this.autoResize.unObserve()
    this.choices.hide()
    this.focusCurrentCell()
    this.cellErrorsManager.dismissErrorForCell(this.cellProperties)
  }

  focus () {
    this.instance.listen()
  }

  /**
   * Focuses on the current cell
   * */
  focusCurrentCell () {
    if (!this.lastCellInfo) return

    const { row, col } = this.lastCellInfo
    this.instance.selectCell(row, col)
  }

  /**
   * Resets an editable element position.
   * Used by the handsontable library.
   */
  showEditableElement () {
    this.textareaParentStyle.opacity = '1'
    this.textareaParentStyle.width = `${this.getEditedCell().getBoundingClientRect().width}px`

    const { childNodes } = this.TEXTAREA_PARENT
    let hasClassHandsontableEditor = false

    rangeEach(childNodes.length - 1, (index) => {
      const childNode = childNodes[index]

      if (hasClass(childNode, 'handsontableEditor')) {
        hasClassHandsontableEditor = true

        return false
      }

      return true
    })

    this.layerClass = (hasClassHandsontableEditor)
      ? EDITOR_VISIBLE_CLASS_NAME
      : this.getEditedCellsLayerClass()
    addClass(this.TEXTAREA_PARENT, this.layerClass)
    removeClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)
  }

  /**
   * onBeforeKeyDown callback.
   *
   * Used to control the state and close the editor when a single-value
   * field has a value.
   * @example: Value "number" cannot accept multiple values.
   * Once user selects a value the dropdown menu shall be closed.
   *
   * @param {Event} event
   */
  onBeforeKeyDown (event) {
    // Ignore if editor is not opened
    if (!this.isOpened()) return

    // Handle Propagation
    switch (event.keyCode) {
      case KEY_CODES.ARROW_UP:
      case KEY_CODES.ARROW_DOWN:
        event.stopImmediatePropagation()
        event.preventDefault()
        event.stopPropagation()
        break
      case 17: // CTRL
      case 224: // CMD (Firefox)
      case 91: // WIN / LCMD
      case 93: // RCMD
      case KEY_CODES.BACKSPACE:
      case KEY_CODES.DELETE:
      case KEY_CODES.HOME:
      case KEY_CODES.END:
      case KEY_CODES.ENTER:
        event.stopImmediatePropagation()
        break
      case KEY_CODES.A:
      case KEY_CODES.X:
      case KEY_CODES.C:
      case KEY_CODES.V: {
        const isCtrlDown = (event.ctrlKey || event.metaKey) && !event.altKey

        if (isCtrlDown) {
          /*
          * CTRL+A, CTRL+C, CTRL+V, CTRL+X should only work locally
          * when cell is edited (not in table context)
          * */
          event.stopImmediatePropagation()
        }
        break
      }
      case KEY_CODES.ARROW_RIGHT:
      case KEY_CODES.ARROW_LEFT: {
        event.stopImmediatePropagation()
        break
      }
      default:
        break
    }

    // Handle Controls
    switch (event.keyCode) {
      case KEY_CODES.ARROW_UP:
      case KEY_CODES.ARROW_DOWN: {
        const direction = (event.keyCode === KEY_CODES.ARROW_DOWN) ? 1 : -1
        this.choices.moveSelection(direction, true)
        break
      }
      case KEY_CODES.ENTER:
        this.choices.addHoveredValue()
        break
      case KEY_CODES.ESCAPE: { // ESC
        this.instance.destroyEditor(true)
        this.focusCurrentCell()
        break
      }
      default:
        break
    }
  }
}

export function MultiSelectRenderer (instance, td, _row, _col, _prop, value, cellProperties) {
  // Add special class to the td so it would be easier
  // for other developers to identify cells multi-select cells.
  addClass(td, CELL_CLASS_NAME)

  // Add forced className
  const forcedClass = String(cellProperties.className || '').trim()

  if (forcedClass) {
    addClass(td, forcedClass)
  }

  // Add disabled className
  if (cellProperties?.select?.readOnly || cellProperties.readOnly) {
    addClass(td, CELL_DISABLED_CLASS_NAME)
  }

  // Forces stringValue to be a string
  const stringValue = value?.toString() ?? ''

  // Creates a new container node
  const container = document.createElement('div')
  addClass(container, CELL_CONTENT_CLASS_NAME)

  // Creates a new span node
  const spanNode = document.createElement('span')
  addClass(spanNode, CELL_CONTENT_VALUE_CLASS_NAME)
  spanNode.textContent = stringValue

  // Creates a new div node and places an arrow in it
  const arrowNode = document.createElement('div')

  // Handsontable has predefined styles for arrows
  addClass(arrowNode, 'htAutocompleteArrow')

  // It's using ASCII arrow, beucase it's faster than svg
  arrowNode.textContent = String.fromCharCode(9660)

  // Adds click event so that when user clicks on the arrow
  // the dropdown would open. So instead of double-clicking the cell
  // user can single-click the dropdown arrow.
  arrowNode.addEventListener('click', (e) => {
    if (cellProperties.readOnly) {
      e.preventDefault()
      return
    }

    instance.getActiveEditor().beginEditing()
  })

  // Append the created nodes to the container
  container.appendChild(spanNode)
  container.appendChild(arrowNode)

  const cellError = td.getAttribute('data-error')

  if (cellError) {
    const errorPopup = document.createElement('span')
    addClass(errorPopup, CELL_ERROR_POPUP_CLASS_NAME)

    errorPopup.textContent = cellError

    addClass(errorPopup, '--error')
    addClass(td, '--error')

    container.append(errorPopup)
  }

  // Remove all content from the cell holder
  // and push the container
  Handsontable.dom.empty(td)
  td.appendChild(container)

  return td
}
