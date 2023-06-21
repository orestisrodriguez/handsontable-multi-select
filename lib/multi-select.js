import Handsontable from 'handsontable'
import ChoicesDropdown from './choices-dropdown'

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
const CELL_DISABLED_CLASS_NAME = 'multi-select__cell--disabled'

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

    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))
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

    const values = originalValue?.toString().split(this.separator).filter(Boolean)
    this.choices.setValues(values)

    this.textareaParentStyle.width = `${this.getEditedCell().getBoundingClientRect().width}px`
    this.lastCellInfo = {
      row, col, prop, td, originalValue, cellProperties,
    }

    // Handles keyboard events when the search is blurred
    this.instance.addHookOnce('beforeKeyDown', HOOK_CALLBACKS.beforeKeyDown.bind(this))

    // Handles keyboard events when search input is selected
    this.choices.setEventListener('explicitKeydown', HOOK_CALLBACKS.explicitKeydown.bind(this))
  }

  /**
   * Opens the editor and adjusts its size.
   */
  open () {
    if (this.selectOptions?.readOnly) return

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
      case 27: { // ESC
        this.instance.destroyEditor(true)
        this.focusCurrentCell()
        break
      }
      default:
        break
    }
  }
}

export function MultiSelectRenderer (instance, td, row, col, prop, value, cellProperties) {
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

  // Remove all content from the cell holder
  // and push the container
  Handsontable.dom.empty(td)
  td.appendChild(container)

  return td
}
