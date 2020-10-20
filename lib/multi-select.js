import Handsontable from 'handsontable'
import OptionsBag from "./OptionsBag"

const {TextEditor} = Handsontable.editors
const {
  addClass, removeClass, hasClass,
} = Handsontable.dom
const {text: TextCellType} = Handsontable.cellTypes
const {KEY_CODES, rangeEach} = Handsontable.helper

const DEFAULT_SEPARATOR = ';'

const EDITOR_HIDDEN_CLASS_NAME = 'ht_editor_hidden'
const EDITOR_VISIBLE_CLASS_NAME = 'ht_editor_visible'

export class MultiSelectEditor extends TextEditor {
  /**
   * Gets current value from editable element.
   *
   * @returns {string}
   */
  getValue = () => this.choices.getValue().join(this.separator)

  /**
   * Creates an editor's elements and adds necessary CSS classnames.
   */
  createElements() {
    // Create textarea and parent
    this.TEXTAREA = document.createElement('select')
    this.TEXTAREA.select = () => null
    this.TEXTAREA.tabIndex = -1
    this.TEXTAREA.style.display = "none"
    addClass(this.TEXTAREA, 'handsontableInput')
    this.TEXTAREA_PARENT = document.createElement('div')
    addClass(this.TEXTAREA_PARENT, 'handsontableInputHolder')

    if (hasClass(this.TEXTAREA_PARENT, this.layerClass)) {
      removeClass(this.TEXTAREA_PARENT, this.layerClass)
    }

    this.TEXTAREA.setAttribute('multiple', "true")

    addClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)

    this.textareaStyle = this.TEXTAREA.style
    this.textareaStyle.width = this.textareaStyle.height = 0
    this.textareaStyle.overflowY = 'visible'

    this.textareaParentStyle = this.TEXTAREA_PARENT.style

    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA)
    this.instance.rootElement.appendChild(this.TEXTAREA_PARENT)

    this.choices = new OptionsBag(this.TEXTAREA)
    this.choices.renderStructure()
    this.choices.addEventListener('change', ({isMultiple, actionType}) => {
      if (!isMultiple && actionType === "add" && this.isOpened())
        this.instance.destroyEditor()
    })

    this.instance.addHook('beforeKeyDown', (event) => this.onBeforeKeyDown(event))
  }

  /**
   * Prepares editor's meta data.
   *
   * @param {Number} row
   * @param {Number} col
   * @param {Number|String} prop
   * @param {HTMLTableCellElement} td
   * @param {*} originalValue
   * @param {Object} cellProperties
   */
  prepare(row, col, prop, td, originalValue, cellProperties) {
    super.prepare(row, col, prop, td, originalValue, cellProperties)

    const {type} = cellProperties
    this.type = type

    this.selectOptions = cellProperties?.select ?? {}
    const config = this.selectOptions?.config
    this.separator = config?.separator ?? DEFAULT_SEPARATOR

    this.valueKey = config?.valueKey ?? 'key'
    this.labelKey = config?.labelKey ?? 'text'

    this.choices.reset()
    this.choices.isMultiple = type !== 'numeric'

    const selectedOptions = (
        originalValue
            ?.toString()
            .split(this.separator)
            .filter(Boolean) // remove empty strings
    ) || []
    this.choices.setValues(selectedOptions)
  }

  /**
   * Opens the editor and adjust its size.
   */
  open() {
    this.refreshDimensions()
    this.choices.setOptions(this.selectOptions.options, this.valueKey, this.labelKey)
    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))
  }

  /**
   * Closes the editor.
   */
  close() {
    this.autoResize.unObserve()
    this.hideEditableElement()
    this.clearHooks()
  }

  focus() {
    this.instance.listen()
  }

  /**
   * Resets an editable element position.
<<<<<<< HEAD
=======
   * Used by the handsontable library.
>>>>>>> 5bc7cee... Styling: Dropdown Dimensions Fix
   */
  showEditableElement() {
    this.textareaParentStyle.height = ''
    this.textareaParentStyle.overflow = ''
    this.textareaParentStyle.position = ''
    this.textareaParentStyle.right = 'auto'
    this.textareaParentStyle.opacity = '1'
    this.textareaParentStyle.width = `${this.getEditedCell().getBoundingClientRect().width}px`

    this.textareaStyle.textIndent = ''
    this.textareaStyle.overflowY = 'hidden'

    const childNodes = this.TEXTAREA_PARENT.childNodes
    let hasClassHandsontableEditor = false

    rangeEach(childNodes.length - 1, (index) => {
      const childNode = childNodes[index]

      if (hasClass(childNode, 'handsontableEditor')) {
        hasClassHandsontableEditor = true

        return false
      }
    })

    if (hasClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)) {
      removeClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)
    }

    if (hasClassHandsontableEditor) {
      this.layerClass = EDITOR_VISIBLE_CLASS_NAME

      addClass(this.TEXTAREA_PARENT, this.layerClass)

    } else {
      this.layerClass = this.getEditedCellsLayerClass()

      addClass(this.TEXTAREA_PARENT, this.layerClass)
    }
  }

  /**
   * onBeforeKeyDown callback.
   *
   * Used to control the state and close the editor when a single-value
   * field has a value.
   * @example: Value "number" cannot accept multiple values. Once user selects a value the dropdown menu
   * shall be closed.
   *
   * @param {Event} event
   */
  onBeforeKeyDown(event) {
    if(!this.isOpened()) return

    // Catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey

    if (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93) {
      // when CTRL or its equivalent is pressed and cell is edited, don't prepare selectable text in textarea
      event.stopImmediatePropagation()
      return
    }

    const {target} = event

    switch (event.keyCode) {
      case KEY_CODES.ARROW_UP:
      case KEY_CODES.ARROW_DOWN:
        event.preventDefault()
        event.stopPropagation()
        event.stopImmediatePropagation()

        const direction = (event.keyCode === KEY_CODES.ARROW_DOWN) ? 1 : -1
        this.choices.moveSelection(direction, true)
        break

      case KEY_CODES.ENTER:
        event.stopImmediatePropagation()
        event.preventDefault()
        event.stopPropagation()

        this.choices.addHoveredValue()
        break

      case KEY_CODES.ARROW_RIGHT:
        if (Handsontable.dom.getCaretPosition(target) !== target.value.length) {
          event.stopImmediatePropagation()
        }
        break

      case KEY_CODES.ARROW_LEFT:
        if (Handsontable.dom.getCaretPosition(target) !== 0) {
          event.stopImmediatePropagation()
        }
        break

      case KEY_CODES.A:
      case KEY_CODES.X:
      case KEY_CODES.C:
      case KEY_CODES.V:
        if (ctrlDown) {
          event.stopImmediatePropagation() // CTRL+A, CTRL+C, CTRL+V, CTRL+X should only work locally when cell is edited (not in table context)
        }
        break

      case KEY_CODES.BACKSPACE:
        event.stopImmediatePropagation()
        break
      case KEY_CODES.DELETE:
      case KEY_CODES.HOME:
      case KEY_CODES.END:
        event.stopImmediatePropagation() // backspace, delete, home, end should only work locally when cell is edited (not in table context)
        break

      default:
        break
    }
  }
}

export function MultiSelectRenderer(instance, td, row, col, prop, value, cellProperties) {
  let stringValue = value?.toString() ?? ''
  TextCellType.renderer(instance, td, row, col, prop, stringValue, cellProperties)

  return td
}
