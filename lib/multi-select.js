import Handsontable from 'handsontable'
import Choices from 'choices.js'

const {TextEditor} = Handsontable.editors
const {
  addClass, removeClass, hasClass,
} = Handsontable.dom
const {text: TextCellType} = Handsontable.cellTypes
const {KEY_CODES, rangeEach} = Handsontable.helper

const defaultSeparator = ','

const EDITOR_HIDDEN_CLASS_NAME = 'ht_editor_hidden'
const EDITOR_VISIBLE_CLASS_NAME = 'ht_editor_visible'

const EditorState = {
  VIRGIN: 'STATE_VIRGIN', // before editing
  EDITING: 'STATE_EDITING',
  WAITING: 'STATE_WAITING', // waiting for async validation
  FINISHED: 'STATE_FINISHED'
}

const classNamesOverride = {
  containerOuter: 'multi-select__choices',
  containerInner: 'multi-select__choices__inner',
  input: 'multi-select__choices__input',
  inputCloned: 'multi-select__choices__input--cloned',
  list: 'multi-select__choices__list',
  listItems: 'multi-select__choices__list--multiple',
  listSingle: 'multi-select__choices__list--single',
  listDropdown: 'multi-select__choices__list--dropdown',
  item: 'multi-select__choices__item',
  itemSelectable: 'multi-select__choices__item--selectable',
  itemDisabled: 'multi-select__choices__item--disabled',
  itemChoice: 'multi-select__choices__item--choice',
  placeholder: 'multi-select__choices__placeholder',
  group: 'multi-select__choices__group',
  groupHeading: 'multi-select__choices__heading',
  button: 'multi-select__choices__button',
}

const numberComparator = ({value: a}, {value: b}) => a - b

export class MultiSelectEditor extends TextEditor {
  /**
   * Gets current value from editable element.
   *
   * @returns {String}
   */
  getValue() {
    const valueArray = this.choices.getValue()
    const formattedValues = valueArray.map(io => io.label)
    return formattedValues.join(this.separator)
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
    const config = this.selectOptions?.config

    const selectOptions = cellProperties?.select
    this.selectOptions = selectOptions || {}

    this.valueKey = config?.valueKey ?? 'value'
    this.labelKey = config?.labelKey ?? 'label'

    if (type === 'numeric') {
      this.separator = '|'
      this.maxItemCount = 1
      this.originalValue = Number.isInteger(originalValue) ? originalValue.toString() : originalValue
    } else {
      this.separator = config?.separator ?? ','
      this.maxItemCount = config?.maxItemCount || -1
    }
  }

  /**
   * Creates an editor's elements and adds necessary CSS classnames.
   */
  createElements() {
    this.TEXTAREA = document.createElement('select')
    this.TEXTAREA.select = () => {
    }
    this.TEXTAREA.tabIndex = -1
    addClass(this.TEXTAREA, 'handsontableInput')
    this.TEXTAREA.setAttribute('multiple', true)

    this.TEXTAREA_PARENT = document.createElement('div')
    addClass(this.TEXTAREA_PARENT, 'handsontableInputHolder')

    if (hasClass(this.TEXTAREA_PARENT, this.layerClass)) {
      removeClass(this.TEXTAREA_PARENT, this.layerClass)
    }

    addClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)

    this.textareaStyle = this.TEXTAREA.style
    this.textareaStyle.width = 0
    this.textareaStyle.height = 0
    this.textareaStyle.overflowY = 'visible'

    this.textareaParentStyle = this.TEXTAREA_PARENT.style

    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA)
    this.instance.rootElement.appendChild(this.TEXTAREA_PARENT)
  }

  /**
   * Opens the editor and adjust its size.
   */
  open() {
    this.refreshDimensions()

    this.instance.addHook('beforeKeyDown', (event) => this.onBeforeKeyDown(event))

    if (this.choices) this.choices.destroy()

    const choicesOptions = {
      classNames: classNamesOverride,
      delimiter: this.separator,
      removeItemButton: true,
      position: 'bottom',
      itemSelectText: '',
      maxItemCount: this.maxItemCount,
    }

    if (this.type === 'numeric') {
      Object.assign(choicesOptions, {
        sorter: numberComparator,
      })
    }
    this.choices = new Choices(this.TEXTAREA, choicesOptions)

    const getOptions = () => {
      const {options} = this.selectOptions
      const toResolve = typeof options === 'function'
          ? options()
          : options
      return Promise.resolve(toResolve)
          .then(((availableOptions) => {
            const {originalValue} = this

            // Condition "originalValue == null" will return true
            // both when the value is undefined and null,
            // since null == undefined.
            if (!originalValue) {
              return availableOptions
            }

            const selectedValues = originalValue.split(this.separator)
            return availableOptions.map((item) => {
              const label = item[this.labelKey]

              return selectedValues.some(io => Object.is(io, label))
                  ? ({...item, selected: true})
                  : item
            })
          }))
    }

    this.choices.setChoices(getOptions, this.valueKey, this.labelKey, true)
    this.choices.passedElement.element.addEventListener('change', () => this.onChoicesChange.bind(this))

    this.choices.showDropdown()

    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))

    this.TEXTAREA_PARENT.querySelector('input').addEventListener('keydown', this.onBeforeKeyDownOnInput.bind(this))
  }

  /**
   * Closes the editor.
   */
  close() {
    // The parent library supports the escape-to-remove action
    // (Remove cell value by pressing the BACKSPACE button)
    // Therefore the close() event can be called even without an open dropdown select.

    this.choices?.hideDropdown()
    this.autoResize.unObserve()
    this.hideEditableElement()
    this.clearHooks()
  }

  focus() {
    this.instance.listen()
  }

  /**
   * Resets an editable element position.
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
   * onChoicesChange callback.
   *
   * Used to control the state and close the editor when a single-value
   * field has a value.
   * @example: Value "number" cannot accept multiple values. Once user selects a value the dropdown menu
   * shall be closed.
   *
   * @param {Event} event
   */
  onChoicesChange(event) {
    const {choices, maxItemCount} = this
    const selected = choices.getValue()

    if (maxItemCount !== -1 && selected.length >= maxItemCount) {
      this.close()
      this.finishEditing()
    }
  }


  /**
   * onBeforeKeyDownOnInput callback.
   *
   * @param {Event} event
   */
  onBeforeKeyDownOnInput(event) {
    switch (event.keyCode) {
      case KEY_CODES.ARROW_UP:
      case KEY_CODES.ARROW_DOWN:
        event.preventDefault()
        event.stopPropagation()
        break

      default:
        break
    }
  }

  /**
   * onBeforeKeyDown callback.
   *
   * @param {Event} event
   */
  onBeforeKeyDown(event) {
    // Catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)
    const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey

    // Process only events that have been fired in the editor
    if (event.target.tagName !== 'INPUT') {
      return
    }
    if (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93) {
      // when CTRL or its equivalent is pressed and cell is edited, don't prepare selectable text in textarea
      event.stopImmediatePropagation()
      return
    }

    const {target} = event

    switch (event.keyCode) {
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

      case KEY_CODES.ENTER:
        event.stopImmediatePropagation()
        event.preventDefault()
        event.stopPropagation()
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
  const {
    config = {},
    options: availableOptions,
  } = cellProperties.select
  const {separator = defaultSeparator} = config

  if (typeof availableOptions === 'undefined' || typeof availableOptions.length === 'undefined' || !availableOptions.length) {
    TextCellType.renderer(instance, td, row, col, prop, value, cellProperties)
    return td
  }

  const stringValue = value?.toString() ?? ''
  const valueArray = stringValue.split(separator)
  const formattedValue = valueArray.join(separator)

  TextCellType.renderer(instance, td, row, col, prop, formattedValue, cellProperties)
  return td
}
