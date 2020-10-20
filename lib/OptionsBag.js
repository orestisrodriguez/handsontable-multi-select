import Handsontable from "handsontable"

const {addClass, removeClass} = Handsontable.dom
const {KEY_CODES} = Handsontable.helper
const KEY_ATTRIBUTE_NAME = "key"
const normalizeOptions = (keyLabel = "key", valueLabel = "value") => (options) => (
    options.map(item => ({
      key: item[keyLabel].toString(),
      value: item[valueLabel].toString()
    }))
)

const ACTIVE_CLASS_NAMES = {
  container: "multi-select__editor",
  valuesContainer: "multi-select__editor-input",
  searchInput: "multi-select__editor-input-search",
  options: "multi-select__editor-options",
  optionsItem: "multi-select__editor-options__item",
  alertSpan: "multi-select__editor-alert",
  valueLabel: "multi-select__editor-label",
}

class SingleEvent {
  constructor(eventKeys = []) {
    this.eventKeys = [] // used to validate the event during the dispatching process
    this.callbacks = []
  }

  /**
   * Saves the target callback.
   * The target function is called when the event is dispatched.
   * */
  addCallback(callback) {
    this.callbacks.push(callback)
  }

  /**
   * Removes a callback from the callbacks array.
   * The passed function will not be called anymore.
   * */
  removeCallback(callback) {
    this.callbacks = this.callbacks.filter(item => item !== callback)
  }

  /**
   * Dispatches all saved callbacks.
   *
   * @param {object} event
   * */
  dispatch(event) {
    // Validate event keys
    const passedKeys = Object.keys(event)
    const missingKey = this.eventKeys.find(key => passedKeys.includes(key))

    if (missingKey) {
      throw new Error(`An incompatible event object. Key "${missingKey}" is missing.`)
    }

    // Invoke all callbacks
    this.callbacks.forEach(callback => callback(event))
  }
}

export default class OptionsBag {
  constructor(textareaNode) {
    this._isMultiple = true

    this.selectedOptions = []
    this.hoveredKey = null
    this.availableOptions = []

    this.nodes = {
      targetNode: textareaNode,
      parentNode: textareaNode.parentNode,
      containerNode: null,
      valuesNode: null,
      optionsNode: null,
      spinnerNode: null,
      searchNode: null
    }

    this.events = {
      "change": new SingleEvent(["isMultiple", "actionType"])
    }
  }

  /**
   * Setter is created to optimize code.
   * Every time when value is reassigned the styles will be updated.
   * */
  set isMultiple(value) {
    this._isMultiple = value

    const changeState = (this._isMultiple) ? removeClass : addClass
    changeState(this.nodes.containerNode, `${ACTIVE_CLASS_NAMES.container}--singular`)
  }

  get isMultiple() {
    return this._isMultiple
  }

  /**
   * Adds input and options nodes to the parent.
   * Should be called after class instantiation.
   *
   * @public
   * */
  renderStructure() {
    // CONTAINER //
    const containerNode = this.nodes.containerNode = document.createElement("div")
    addClass(containerNode, ACTIVE_CLASS_NAMES.container)

    // AVAILABLE OPTIONS SEARCH
    const searchNode = this.nodes.searchNode = document.createElement("input")
    addClass(searchNode, ACTIVE_CLASS_NAMES.searchInput)

    searchNode.addEventListener('input', ({target, keyCode}) => {
      const {value} = target

      // Resize the input
      target.style.width = value.length + 1 + "ch"

      // Filter the options
      this.filterOptionsByQuery(value)
    })

    searchNode.addEventListener('keydown', ({target, keyCode}) => {
      // If backspace + empty field -> remove the last value
      if (keyCode === KEY_CODES.BACKSPACE && !target.value.replace(/\s|\n/g, "")) {
        this.removeLastValue()
      }
    })

    // SELECTED OPTIONS //
    const valuesNode = this.nodes.valuesNode = document.createElement("div")
    addClass(valuesNode, ACTIVE_CLASS_NAMES.valuesContainer)
    valuesNode.appendChild(searchNode)

    valuesNode.addEventListener('click', ({target}) => {
      const isLabel = target.classList.contains(ACTIVE_CLASS_NAMES.valueLabel)
      if (!isLabel) {
        this.nodes.searchNode.focus()
      }
    })

    // AVAILABLE OPTIONS //
    const optionsNode = this.nodes.optionsNode = document.createElement("div")
    addClass(optionsNode, ACTIVE_CLASS_NAMES.options)

    // ASYNC LOADING SPINNER //
    const spinnerNode = this.nodes.spinnerNode = document.createElement("span")
    addClass(spinnerNode, ACTIVE_CLASS_NAMES.alertSpan)
    spinnerNode.textContent = "Loading options..."

    // Push nodes
    this.nodes.parentNode.appendChild(containerNode)
    containerNode.appendChild(valuesNode)
    containerNode.appendChild(spinnerNode)
    containerNode.appendChild(optionsNode)
  }

  /**
   * Replaces options with new values.
   *
   * @public
   * @param {Array|Promise<Array<object>|Function>} options
   * @param {string} itemsKey
   * @param {string} itemsValue
   * */
  setOptions(options, itemsKey, itemsValue) {
    // Resolve the function and continue
    const fetchOptions = (options.constructor === Function)
        ? options
        : () => options

    this.showSpinner()
    Promise.resolve(fetchOptions())
        .then(normalizeOptions(itemsKey, itemsValue))
        .then(options => this.availableOptions = options)
        .then(this.renderOptionNodes.bind(this))
        .then(this.hideSpinner)
  }

  /**
   * Adds option and pushes it into the DOM tree.
   *
   * @param {string} value
   * @param {string} key
   * */
  addOption(value, key) {
    const optionInfo = {value, key}

    this.availableOptions.push(optionInfo)
    this.renderOptionNodes([optionInfo], false)
  }

  /**
   * Creates and adds items (nodes) to the options container.
   *
   * @param {Array} options
   * @param {boolean} doResetTree
   * */
  renderOptionNodes(options, doResetTree = true) {
    this.hoveredKey = null

    if (doResetTree) {
      // Clear the list before adding
      Handsontable.dom.empty(this.nodes.optionsNode)
    }

    // Keep track of keys to prevent keys duplication
    const knownKeys = []

    options.forEach(({value, key}) => {
      // Skip if there's a selected option with the same value
      if (this.selectedOptions.some(item => item.value === value))
        return

      // Add to the list even if there's a duplication
      const optionNode = this.createOptionNode(value, key)
      this.nodes.optionsNode.appendChild(optionNode)

      // Inform the dev
      if (knownKeys.includes(key)) {
        throw new Error(`Key Duplication Warning. Two or more elements with the same key: "${key}"`)
      }
      knownKeys.push(key)
    })
  }

  /**
   * Takes a string and searches for occurrences in the available options array.
   * Found occurrences will replace the current content of the options container.
   *
   * @param {string} query
   * */
  filterOptionsByQuery(query = "") {
    const isQueryEmpty = !query.replace(/\s|\n/g, "").length
    let filteredOptions = this.availableOptions

    // Search for occurrences if query is not empty
    if (!isQueryEmpty) {
      filteredOptions = this.availableOptions.filter(item => (
          item.value
              .toLowerCase()
              .includes(query.toLowerCase())
      ))
    }

    this.renderOptionNodes(filteredOptions, true)
  }

  /**
   * Adds option value to the state
   * and removes the item from the options list.
   *
   * @param {string} key
   * @param {string} value
   * @param {boolean} isCalledByUser
   *
   * Since the function can be called by the rendering mechanism we should keep track on who/what called
   * the function, to prevent stack overflow (infinite recursion).
   * */
  addValue(value, key, isCalledByUser = false) {
    // Remove item the options list
    this.removeOption(key)

    const willReplace = !this._isMultiple && isCalledByUser

    // Next value will override the previous one.
    if (willReplace) this.reset()
    this.selectedOptions.push({key, value})
    this.nodes.valuesNode.insertBefore(this.createValueNode(value, key), this.nodes.searchNode)

    this.events.change.dispatch({
      isMultiple: this.isMultiple,
      actionType: "add"
    })
  }

  /**
   * Adds hovered option value to the state.
   * */
  addHoveredValue() {
    const targetNode = this.nodes.optionsNode
        .querySelector(`[${KEY_ATTRIBUTE_NAME}="${this.hoveredKey}"]`)

    this.addValue(
        targetNode.textContent,
        targetNode.getAttribute(KEY_ATTRIBUTE_NAME),
        true
    )
  }

  /**
   * Creates a DOM node for the chosen values list (input div)
   *
   * @param {string} value
   * @param {string} key
   * @return {HTMLElement} valueNode
   * */
  createValueNode(value, key) {
    const valueNode = document.createElement("span")
    addClass(valueNode, ACTIVE_CLASS_NAMES.valueLabel)
    valueNode.setAttribute(KEY_ATTRIBUTE_NAME, key)
    valueNode.textContent = value

    // Remove node and value on click
    valueNode.addEventListener('click', () => {
      this.removeValue(key)
      this.events.change.dispatch({
        isMultiple: this.isMultiple,
        actionType: "remove"
      })
    })

    return valueNode
  }

  /**
   * Removes item from the values list.
   *
   * @param {string} key
   * */
  removeValue(key) {
    const el = this.nodes.valuesNode.querySelector(`[${KEY_ATTRIBUTE_NAME}="${key}"]`)

    this.selectedOptions = this.selectedOptions.filter(item => item.key !== key)
    el.parentNode.removeChild(el)

    this.addOption(el.textContent, key)
  }

  /**
   * Removes the last selected option in the list.
   * */
  removeLastValue() {
    // The last label will be right before the search input
    const lastLabelNode = this.nodes.searchNode.previousSibling
    if (!lastLabelNode) return

    this.removeValue(lastLabelNode.getAttribute(KEY_ATTRIBUTE_NAME))
  }

  /**
   * Removes all selected options.
   * */
  removeAllValues() {
    Handsontable.dom.empty(this.nodes.valuesNode)
    this.nodes.valuesNode.appendChild(this.nodes.searchNode)
  }

  /**
   * Creates a DOM node for the options list (options div).
   *
   * @param {string} value
   * @param {string} key
   * @return {HTMLElement} optionNode
   * */
  createOptionNode(value, key) {
    const optionNode = document.createElement("div")
    optionNode.innerHTML = `<span>${value}</span><span icon></span>`
    addClass(optionNode, ACTIVE_CLASS_NAMES.optionsItem)
    optionNode.setAttribute(KEY_ATTRIBUTE_NAME, key)

    optionNode.addEventListener('mouseenter', ({target}) => {
      this.hoverOption(target)
    })

    optionNode.addEventListener('click', () => {
      this.addValue(value, key, true)
    })

    return optionNode
  }

  /**
   * Updates option nodes.
   *
   * @param {HTMLElement} targetNode
   * */
  hoverOption(targetNode) {
    const attrName = "hovered"

    // Remove attribute from the currently selected node
    if (this.hoveredKey) {
      this.nodes.optionsNode
          .querySelector(`[${KEY_ATTRIBUTE_NAME}="${this.hoveredKey}"]`)
          ?.removeAttribute(attrName)
    }

    // Update the state value
    this.hoveredKey = targetNode.getAttribute(KEY_ATTRIBUTE_NAME)

    // Update the hovered node
    targetNode.setAttribute(attrName, "true")

    // Scroll if needed
    this.scrollToSelection(targetNode)
  }

  /**
   * Moves selection.
   * If position \current+direction\ has no value then the cursor will remain on the same position.
   *
   * @param {number} direction - "1" (down) or "-1" (up)
   * @param {boolean} ignoreMissing - Don't do anything if there's no element at that direction.
   */
  moveSelection(direction, ignoreMissing = false) {
    let hoveredNode = this.nodes.optionsNode
        .querySelector(`[${KEY_ATTRIBUTE_NAME}="${this.hoveredKey}"]`)
    let targetNode = null

    // Select first element if no selection information is available
    if (!hoveredNode) {
      targetNode = this.nodes.optionsNode.firstElementChild

      // Ignore if there are no available options
      if (!targetNode) return
    } else {
      const {nextSibling: nextNode, previousSibling: prevNode} = hoveredNode
      targetNode = (direction === 1) ? nextNode : prevNode

      // "Bounce" the selection if there are no elements at that direction
      if (!ignoreMissing && !targetNode) {
        targetNode = (direction === 1) ? prevNode : nextNode
      }
    }

    // Resets the variable if there are no options left
    if (targetNode) this.hoverOption(targetNode)
  }

  /**
   * Scrolls the dropdown options list till
   * the selected element is in the viewport (is visible)
   *
   * @param {HTMLElement} targetChild
   * */
  scrollToSelection(targetChild) {
    const {top: ctop, bottom: cbottom} = targetChild.parentNode.getBoundingClientRect()
    let {top: etop, bottom: ebottom, height: eheight} = targetChild.getBoundingClientRect()

    const viewMargin = 5

    etop -= viewMargin
    ebottom += viewMargin
    eheight -= viewMargin

    const isInView = etop <= ctop
        ? ctop - etop <= eheight
        : ebottom - cbottom <= eheight


    if (isInView) return
    targetChild.scrollIntoView()
  }

  /**
   * Removes item from the options list.
   *
   * @param {string} key
   * */
  removeOption(key) {
    // Select next item in the list
    this.moveSelection(1)

    // Remove current item from the list
    const el = this.nodes.optionsNode.querySelector(`[${KEY_ATTRIBUTE_NAME}="${key}"]`)
    if (!el) return

    el.parentNode.removeChild(el)
    this.availableOptions = this.availableOptions.filter(item => item.key !== key)
  }

  /**
   * Returns instance of an event.
   *
   * @param {string} eventName
   * @return {CustomEvent}
   * */
  getEventInstance(eventName) {
    const eventInstance = this.events[eventName]

    // Check if eventName is valid
    if (!eventInstance) {
      throw new Error(`Unknown event: "${eventName}"`)
    }

    return eventInstance
  }

  /**
   * Adds an event listener.
   *
   * @param {string} eventName
   * @param {function} callback
   * */
  addEventListener(eventName, callback) {
    this.getEventInstance(eventName)?.addCallback(callback)
  }

  /**
   * Removes an event listener.
   *
   * @param {string} eventName
   * @param {function} callback
   **/
  removeEventListener(eventName, callback) {
    this.getEventInstance(eventName)?.removeCallback(callback)
  }

  /**
   * Shows loading spinner in the dropdown container.
   * */
  showSpinner = () => {
    addClass(this.nodes.spinnerNode, `${ACTIVE_CLASS_NAMES.alertSpan}--visible`)
  }

  /**
   * Hides spinner in the dropdown container.
   * */
  hideSpinner = () => {
    removeClass(this.nodes.spinnerNode, `${ACTIVE_CLASS_NAMES.alertSpan}--visible`)
  }

  /**
   * Removes all options and clears the options state
   *
   * @public
   * */
  reset() {
    this.availableOptions = []
    this.hoveredKey = null
    this.selectedOptions = []
    this.nodes.optionsNode.innerHTML = String()
    this.nodes.searchNode.value = String()
    this.removeAllValues()
  }

  /**
   * Returns value in the preferable format.
   *
   * @public
   * @return {Array}
   * */
  getValue = () => {
    return this.selectedOptions.map(item => item.value)
  }

  /**
   * Adds items to the selectedOptions
   *
   * @public
   * @param {Array} values
   * */
  setValues = (values) => {
    this.removeAllValues()

    values.forEach((value, key) => {
      this.addValue(value, key)
    })
  }
}