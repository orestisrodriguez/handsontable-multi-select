import Handsontable from 'handsontable/dist/handsontable.full'
import Choices from 'choices.js'
import R from 'ramda'

const { TextEditor } = Handsontable.editors
const {
  addClass, removeClass, hasClass,
} = Handsontable.dom
const { text: TextCellType } = Handsontable.cellTypes
const { KEY_CODES } = Handsontable.helper

const EDITOR_HIDDEN_CLASS_NAME = 'ht_editor_hidden'

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
  activeState: 'multi-select__choices--is-active',
  focusState: 'multi-select__choices--is-focused',
  openState: 'multi-select__choices--is-open',
  disabledState: 'multi-select__choices--is-disabled',
  highlightedState: 'multi-select__choices--is-highlighted',
  selectedState: 'multi-select__choices--is-selected',
  flippedState: 'multi-select__choices--is-flipped',
  loadingState: 'multi-select__choices--is-loading',
  noResults: 'multi-select__choices--has-no-results',
  noChoices: 'multi-select__choices--has-no-choices',
}

export class MultiSelectEditor extends TextEditor {
  /**
   * Gets current value from editable element.
   *
   * @returns {Number}
   */
  getValue () {
    const valueArray = this.choices.getValue()
    const formattedValues = R.map((value) => value.label, valueArray)
    return formattedValues.join(',')
  }

  /**
   * Sets new value into editable element.
   *
   * @param {*} newValue
   */
  setValue (newValue) {
    if (!this.choices) return
		if (R.isNil(newValue)) {
			this.choices.setValue([])
			return
		}

    const formattedValue = newValue.split(',')
    this.choices.setValue(formattedValue)
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
  prepare (row, col, prop, td, originalValue, cellProperties) {
    super.prepare(row, col, prop, td, originalValue, cellProperties)
    const selectOptions = R.prop('select', cellProperties)

    this.selectOptions = R.defaultTo({}, selectOptions)
  }

  /**
   * Creates an editor's elements and adds necessary CSS classnames.
   */
  createElements () {
    this.TEXTAREA = document.createElement('select')
    this.TEXTAREA.select = () => {}
    this.TEXTAREA.tabIndex = -1

    addClass(this.TEXTAREA, 'handsontableInput')
    this.TEXTAREA.setAttribute('multiple', true)

    this.textareaStyle = this.TEXTAREA.style
    this.textareaStyle.width = 0
    this.textareaStyle.height = 0
    this.textareaStyle.overflowY = 'visible'

    this.TEXTAREA_PARENT = document.createElement('div')
    addClass(this.TEXTAREA_PARENT, 'handsontableInputHolder')

    if (hasClass(this.TEXTAREA_PARENT, this.layerClass)) {
      removeClass(this.TEXTAREA_PARENT, this.layerClass)
    }

    addClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME)

    this.textareaParentStyle = this.TEXTAREA_PARENT.style

    this.TEXTAREA_PARENT.appendChild(this.TEXTAREA)
    this.instance.rootElement.appendChild(this.TEXTAREA_PARENT)
  }

  /**
   * Opens the editor and adjust its size.
   */
  open () {
    this.refreshDimensions()
    this.textareaParentStyle.display = 'block'

    this.instance.addHook('beforeKeyDown', (event) => this.onBeforeKeyDown(event))

    if (this.choices) this.choices.destroy()

    this.choices = new Choices(this.TEXTAREA, { classNames: classNamesOverride })

    const allChoices = R.map((choice) => ({
      value: choice.key,
      label: choice.text,
    }), this.selectOptions.options)

    const hasCurrentChoice = !R.isNil(this.originalValue) && !R.isEmpty(this.originalValue)
    const currentChoice = hasCurrentChoice
      ? R.map((label) => R.find(R.propEq('label', label), allChoices).value, this.originalValue.split(','))
      : []

    this.choices.setChoices(allChoices, 'value', 'label', true)
    this.choices.setChoiceByValue(currentChoice)

    this.choices.showDropdown()

    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))

    this.TEXTAREA_PARENT.querySelector('input').addEventListener('keydown', this.onBeforeKeyDownOnInput.bind(this))
  }

  /**
   * Closes the editor.
   */
  close () {
    this.autoResize.unObserve()
    this.textareaParentStyle.display = 'none'

    this.instance.removeHook('beforeKeyDown', this.onBeforeKeyDown)
  }

  focus () {
    this.instance.listen()
  }

  /**
   * onBeforeKeyDownOnInput callback.
   *
   * @param {Event} event
   */
  onBeforeKeyDownOnInput (event) {
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
  onBeforeKeyDown (event) {
    const keyCodes = Handsontable.helper.KEY_CODES
    const ctrlDown = (event.ctrlKey || event.metaKey) && !event.altKey // catch CTRL but not right ALT (which in some systems triggers ALT+CTRL)

    // Process only events that have been fired in the editor
    if (event.target.tagName !== 'INPUT') {
      return
    }
    if (event.keyCode === 17 || event.keyCode === 224 || event.keyCode === 91 || event.keyCode === 93) {
      // when CTRL or its equivalent is pressed and cell is edited, don't prepare selectable text in textarea
      event.stopImmediatePropagation()
      return
    }

    const { target } = event

    switch (event.keyCode) {
      case keyCodes.ARROW_RIGHT:
        if (Handsontable.dom.getCaretPosition(target) !== target.value.length) {
          event.stopImmediatePropagation()
        }
        break

      case keyCodes.ARROW_LEFT:
        if (Handsontable.dom.getCaretPosition(target) !== 0) {
          event.stopImmediatePropagation()
        }
        break

      case keyCodes.ENTER:
        event.stopImmediatePropagation()
        event.preventDefault()
        event.stopPropagation()
        break

      case keyCodes.A:
      case keyCodes.X:
      case keyCodes.C:
      case keyCodes.V:
        if (ctrlDown) {
          event.stopImmediatePropagation() // CTRL+A, CTRL+C, CTRL+V, CTRL+X should only work locally when cell is edited (not in table context)
        }
        break

      case keyCodes.BACKSPACE:
        event.stopImmediatePropagation()
        break
      case keyCodes.DELETE:
      case keyCodes.HOME:
      case keyCodes.END:
        event.stopImmediatePropagation() // backspace, delete, home, end should only work locally when cell is edited (not in table context)
        break

      default:
        break
    }
  }
}

export function MultiSelectRenderer (instance, td, row, col, prop, value, cellProperties) {
  const { options: availableOptions, separator } = cellProperties.select

  if (typeof availableOptions === 'undefined' || typeof availableOptions.length === 'undefined' || !availableOptions.length) {
    TextCellType.renderer(instance, td, row, col, prop, value, cellProperties)
    return td
  }

  const stringValue = value ? `${value}` : ''
  const valueArray = stringValue.split(',')
  const formattedValue = valueArray.join(separator || ', ')

  TextCellType.renderer(instance, td, row, col, prop, formattedValue, cellProperties)
  return td
}
