import Handsontable from 'handsontable/dist/handsontable.full'
import Choices from 'choices.js'
import R from 'ramda'

const { TextEditor } = Handsontable.editors
const {
  addClass, removeClass, hasClass, offset,
} = Handsontable.dom
const { text: TextCellType } = Handsontable.cellTypes
const { KEY_CODES, rangeEach } = Handsontable.helper

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

const getSeparator = R.path([ 'config', 'separator' ])
const getLabelKey = R.path([ 'config', 'labelKey' ])
const getValueKey = R.path([ 'config', 'valueKey' ])

export class MultiSelectEditor extends TextEditor {
  /**
   * Gets current value from editable element.
   *
   * @returns {String}
   */
  getValue () {
    const valueArray = this.choices.getValue()
    const formattedValues = R.pluck('label', valueArray)
    return formattedValues.join(this.separator)
  }

  /**
   * Sets new value into editable element.
   *
   * @param {*} newValue
   */
  setValue () {
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
    this.valueKey = getValueKey(this.selectOptions) || 'value'
    this.labelKey = getLabelKey(this.selectOptions) || 'label'
    this.separator = getSeparator(this.selectOptions) || ','
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
  open () {
    this.refreshDimensions()
    this.showEditableElement()

    this.instance.addHook('beforeKeyDown', (event) => this.onBeforeKeyDown(event))

    if (this.choices) this.choices.destroy()

    this.choices = new Choices(this.TEXTAREA, {
      classNames: classNamesOverride,
      delimiter: this.separator,
      removeItemButton: true,
      position: 'bottom',
      itemSelectText: '',
    })

    const getOptions = () => {
      const { options } = this.selectOptions
      const toResolve = typeof options === 'function'
        ? options(this.instance)
        : options
      return Promise.resolve(toResolve)
        .then(((availableOptions) => {
          const { originalValue } = this
          if (R.isEmpty(originalValue) || R.isNil(originalValue)) {
            return availableOptions
          }

          const selectedValues = originalValue.split(this.separator)
          return R.map((item) => {
            const label = R.prop(this.labelKey, item)
            return R.any(R.identical(label), selectedValues)
              ? R.assoc('selected', true, item)
              : item
          }, availableOptions)
        }))
    }

    this.choices.setChoices(getOptions, this.valueKey, this.labelKey, true)

    this.choices.showDropdown()

    this.TEXTAREA.addEventListener('hideDropdown', this.close.bind(this))

    this.TEXTAREA_PARENT.querySelector('input').addEventListener('keydown', this.onBeforeKeyDownOnInput.bind(this))
  }

  /**
   * Closes the editor.
   */
  close () {
    this.autoResize.unObserve()
    this.hideEditableElement()

    super.close()
  }

  focus () {
    this.instance.listen()
  }

  hideEditableElement () {
    this.textareaStyle.overflowY = 'visible';

    this.textareaParentStyle.opacity = '0';
    this.textareaParentStyle.height = '1px';

    if (hasClass(this.TEXTAREA_PARENT, this.layerClass)) {
      removeClass(this.TEXTAREA_PARENT, this.layerClass);
    }

    addClass(this.TEXTAREA_PARENT, EDITOR_HIDDEN_CLASS_NAME);
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

  /**
   * Gets className of the edited cell if exist.
   *
   * @returns {string}
   */
  getEditedCellsLayerClass() {
    const editorSection = this.checkEditorSection();

    switch (editorSection) {
      case 'right':
        return 'ht_clone_right';
      case 'left':
        return 'ht_clone_left';
      case 'bottom':
        return 'ht_clone_bottom';
      case 'bottom-right-corner':
        return 'ht_clone_bottom_right_corner';
      case 'bottom-left-corner':
        return 'ht_clone_bottom_left_corner';
      case 'top':
        return 'ht_clone_top';
      case 'top-right-corner':
        return 'ht_clone_top_right_corner';
      case 'top-left-corner':
        return 'ht_clone_top_left_corner';
      default:
        return 'ht_clone_master';
    }
  }
}

export function MultiSelectRenderer (instance, td, row, col, prop, value, cellProperties) {
  const {
    config = {},
    options: availableOptions,
  } = cellProperties.select
  const { separator = defaultSeparator } = config

  if (typeof availableOptions === 'undefined' || typeof availableOptions.length === 'undefined' || !availableOptions.length) {
    TextCellType.renderer(instance, td, row, col, prop, value, cellProperties)
    return td
  }

  const stringValue = value ? `${value}` : ''
  const valueArray = stringValue.split(separator)
  const formattedValue = valueArray.join(separator)

  TextCellType.renderer(instance, td, row, col, prop, formattedValue, cellProperties)
  return td
}
