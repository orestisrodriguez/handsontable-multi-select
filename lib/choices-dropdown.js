import Handsontable from 'handsontable'
import SingleEvent from './single-event'
import {
  isEmptyString,
  normalizeOptions,
  findNode,
  scrollToSelection,
} from './utils'

const { addClass, removeClass } = Handsontable.dom
const { KEY_CODES } = Handsontable.helper

const ACTIVE_CLASS_NAMES = {
  container: [ 'multi-select__choices' ],
  valuesContainer: [ 'multi-select__choices__inner multi-select__choices__list--multiple' ],
  searchInput: [ 'multi-select__choices__input' ],
  options: [ 'multi-select__choices__list', 'multi-select__choices__list--dropdown' ],
  optionsItem: [ 'multi-select__choices__item', 'multi-select__choices__item--single', 'multi-select__choices__item--selectable', 'multi-select__choices__item--choice' ],
  messageSpan: [ 'multi-select__choices__item', 'multi-select__choices__item--disabled', 'multi-select__choices__message' ],
  valueLabel: [ 'multi-select__choices__item' ],
  fetchingClass: [ 'is-fetching' ],
  hoveredClass: [ 'is-highlighted' ],
}

const NODE_CREATORS = {
  createOptionsNode () {
    const optionsNode = document.createElement('div')
    addClass(optionsNode, ACTIVE_CLASS_NAMES.options.join(' '))

    return optionsNode
  },
  createSpinnerNode () {
    const messageNode = document.createElement('span')
    addClass(messageNode, ACTIVE_CLASS_NAMES.messageSpan.join(' '))

    return messageNode
  },
  createValuesNode (searchNode) {
    const valuesNode = document.createElement('div')
    addClass(valuesNode, ACTIVE_CLASS_NAMES.valuesContainer.join(' '))
    valuesNode.appendChild(searchNode)

    // Focus on the search input if user is not attempting to remove a value
    valuesNode.addEventListener('click', ({ target }) => {
      const isLabel = target.classList.contains(ACTIVE_CLASS_NAMES.valueLabel[0])
      if (!isLabel) {
        this.focusSearch()
      }
    })

    return valuesNode
  },
  createContainerNode () {
    const containerNode = document.createElement('div')
    addClass(containerNode, ACTIVE_CLASS_NAMES.container.join(' '))

    return containerNode
  },
  createSearchNode () {
    const callInputEvent = (event) => this.events.explicitKeydown.dispatch({ event })

    const searchNode = document.createElement('input')
    searchNode.setAttribute('type', 'text')
    addClass(searchNode, ACTIVE_CLASS_NAMES.searchInput.join(' '))

    // Resize input based on it's value length
    searchNode.addEventListener('input', ({ target }) => {
      const { value } = target

      // Resize the input
      // eslint-disable-next-line no-param-reassign
      target.style.width = `${value.length + 1}ch`

      // Filter the options
      this.searchOptions(value)
    })

    // Allow using vertical arrows to control options selection
    searchNode.addEventListener('keydown', (event) => {
      // Prevent the input if suggestions are still fetching
      if (this.isFetching) {
        event.preventDefault()
        return
      }

      const { target, keyCode } = event

      // If backspace + empty field -> remove the last value
      if (keyCode === KEY_CODES.BACKSPACE
          && isEmptyString(target.value)) {
        this.removeLastValue()
      }

      callInputEvent(event)
    })

    return searchNode
  },
}

export default class ChoicesDropdown {
  constructor (textareaNode) {
    /**
     * Represents if user can choose
     * more than one value.
     *
     * @type {boolean}
     * */
    this._isMultiple = true

    /**
     * Last searched query in
     * the available options search box.
     *
     * @type {string|null}
     * */
    this.lastSearchQuery = null

    /**
     * List of currently selected options.
     *
     * @type {any[]}
     * */
    this.selectedOptions = []

    /**
     * Key of the currently hovered item in the available options list.
     *
     * @type {string|null}
     * */
    this.hoveredKey = null

    /**
     * List of currently available options
     * that can be selected.
     *
     * @type {any[]}
     * */
    this.availableOptions = []

    /**
     * Represents if a suggestions promise is currently resolving.
     * Setting this value to true will disable the search input.
     *
     * @type {boolean}
     * */
    this.isFetching = false

    /**
     * Dictionary of node elements that
     * are used to control the dropdown.
     *
     * @property {HTMLElement} targetNode
     * @property {HTMLElement} parentNode
     * @property {HTMLElement} containerNode
     * @property {HTMLElement} valuesNode
     * @property {HTMLElement} optionsNode
     * @property {HTMLElement} messageNode
     * @property {HTMLElement} searchNode
     * */
    this.nodes = {
      targetNode: textareaNode,
      parentNode: textareaNode.parentNode,
      containerNode: null,
      valuesNode: null,
      optionsNode: null,
      messageNode: null,
      searchNode: null,
    }

    /**
     * List of all available events and their handlers.
     *
     * @property {SingleEvent} change
     * @property {SingleEvent} explicitKeydown
     * */
    this.events = {
      change: new SingleEvent([ 'isMultiple', 'actionType', 'value' ]),
      explicitKeydown: new SingleEvent([ 'event' ]),
    }
  }

  /**
   * Setter is created to optimize code.
   * Every time when value is reassigned the styles will be updated.
   * */
  set isMultiple (value) {
    this._isMultiple = value
    this.updateClasses()
  }

  get isMultiple () {
    return this._isMultiple
  }

  /**
   * Updates classList for the dropdown container.
   * */
  updateClasses () {
    const classTarget = [ this.nodes.containerNode, `${ACTIVE_CLASS_NAMES.container[0]}--singular` ]

    if (this.isMultiple) {
      removeClass(...classTarget)
    } else {
      addClass(...classTarget)
    }
  }

  /**
   * Adds input and options nodes to the parent.
   * Should be called after class instantiation.
   *
   * @public
   * */
  renderStructure () {
    const containerNode = NODE_CREATORS.createContainerNode.call(this)
    this.nodes.containerNode = containerNode

    const searchNode = NODE_CREATORS.createSearchNode.call(this)
    this.nodes.searchNode = searchNode

    const valuesNode = NODE_CREATORS.createValuesNode.call(this, searchNode)
    this.nodes.valuesNode = valuesNode

    const optionsNode = NODE_CREATORS.createOptionsNode.call(this)
    this.nodes.optionsNode = optionsNode

    const messageNode = NODE_CREATORS.createSpinnerNode.call(this)
    this.nodes.messageNode = messageNode

    // Push nodes
    this.nodes.parentNode.appendChild(containerNode)
    containerNode.appendChild(valuesNode)
    containerNode.appendChild(messageNode)
    containerNode.appendChild(optionsNode)
  }

  /**
   * Replaces options with new values.
   *
   * @public
   * @param {Array|Promise<Array<object>|Function>} options
   * @param {object} itemKeys - object with two keys - "key" and "value". The values will be used
   * as keys for the option items.
   * @param {object} cellArguments - information about the active cell.
   * */
  setOptions (options, itemKeys, cellArguments) {
    const { key: itemsKey, value: itemsValue } = itemKeys
    const { cellProperties, originalValue } = cellArguments

    // Force options argument to be a function
    // so it'd be easier to process it later
    const fetchOptions = (typeof options === 'function')
      ? options
      : () => options

    // Reset options
    this.removeAllOptions()

    // Show loading message
    this.startFetchingMode()

    // Handle promise and render items based on the normalized values
    Promise.resolve(fetchOptions(cellProperties, originalValue))
      .then(normalizeOptions(itemsKey, itemsValue))
      .then((availableOptions) => {
        this.stopFetchingMode()
        // Shows "no suggestions" message if no suggestions received
        if (availableOptions.length <= 0 && this.selectedOptions.length <= 0) {
          this.showMessage('No suggestions')
        }

        // Passes received options to the next function
        return availableOptions
      })
      .then((normalizedOptions) => {
        // Doesn't process the item if the option with the key is selected
        this.availableOptions = normalizedOptions.filter((available) => (
          !this.selectedOptions.some((selected) => selected.value === available.value)
        ))

        return this.availableOptions
      })
      .then(this.renderOptionNodes.bind(this))
  }

  /**
   * Adds option and pushes it into the DOM tree.
   *
   * @param {string} value
   * @param {string} key
   * */
  addOption (value, key) {
    // Skips if option with that name already exists
    if (this.availableOptions.some((item) => item.value === value)) {
      return
    }

    // Construct an object item
    const optionInfo = { value, key }

    // Push to the options list
    this.availableOptions.push(optionInfo)
    this.renderOptionNodes([ optionInfo ])

    // Refresh the list if user is searching for something
    if (this.lastSearchQuery) {
      this.searchOptions(this.lastSearchQuery)
    }
  }

  /**
   * Removes all nodes in the options container.
   * */
  resetOptionsContainer () {
    Handsontable.dom.empty(this.nodes.optionsNode)
    this.hoveredKey = null
  }

  /**
   * Creates and adds items (nodes) to the options container.
   *
   * @param {Array} options
   * @return {Array} options - passed options
   * */
  renderOptionNodes (options) {
    // Save keys as we iterate to prevent keys duplication
    const knownKeys = []

    options.forEach(({ value, key }) => {
      // Add to the list even if there's a keys duplication
      const optionNode = this.createOptionNode(value, key)
      this.nodes.optionsNode.appendChild(optionNode)

      // Inform the dev
      if (knownKeys.includes(key)) {
        // eslint-disable-next-line no-console
        console.warn(`Keys duplication detected. Two or more elements have the same key: "${key}"`)
      }
      knownKeys.push(key)
    })

    return options
  }

  /**
   * Takes a string and searches for occurrences in the available options array.
   * Found occurrences will replace the current content of the options container.
   *
   * @param {string} query
   * */
  searchOptions (query = '') {
    this.lastSearchQuery = query
    const filteredOptions = this.filterOptionsByQuery(query)

    this.resetOptionsContainer()
    this.renderOptionNodes(filteredOptions)
  }

  /**
   * Filters the available options.
   *
   * @param {string|null} query - filter
   * @return {any[]}
   * */
  filterOptionsByQuery (query) {
    return (
      (isEmptyString(query))
        ? this.availableOptions
        : this.availableOptions.filter((item) => (
          item.value
            .toLowerCase()
            .includes(query.toLowerCase())
        ))
    )
  }

  /**
   * Adds option value to the state
   * and removes the item from the options list.
   *
   * @param {string} key
   * @param {string} value
   * @param {boolean} isCalledByUser
   *
   * Since the function can be called by the
   * rendering mechanism we should keep track on who/what called
   * the function, to prevent the stack overflow issue (endless recursion).
   * */
  addValue (value, key, isCalledByUser = false) {
    // Remove item the options list
    this.removeOption(key)

    // Next value will override the previous one
    if (isCalledByUser) {
      // Replace current value if field cannot have more than one value
      if (!this.isMultiple) this.removeAllValues()

      // Clear search input
      this.resetSearchInput()
    }

    // Add item to the available options list.
    this.selectedOptions.push({ key, value })
    this.nodes.valuesNode.insertBefore(this.createValueNode(value, key), this.nodes.searchNode)

    // Dispatch the update event
    this.events.change.dispatch({
      isMultiple: this.isMultiple,
      value: this.selectedOptions,
      actionType: 'add',
    })
  }

  /**
   * Adds hovered option value to the state.
   * */
  addHoveredValue () {
    const targetNode = this.findOptionsNode(this.hoveredKey)

    // Skip if no value is hovered
    if (!targetNode) return

    this.addValue(
      targetNode.textContent,
      this.hoveredKey,
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
  createValueNode (value, key) {
    const valueNode = document.createElement('span')
    addClass(valueNode, ACTIVE_CLASS_NAMES.valueLabel.join(' '))
    valueNode.setAttribute('key', key)
    valueNode.textContent = value

    // Removes node and value on click
    valueNode.addEventListener('click', () => {
      this.removeValue(key)
      this.focusSearch()
    })

    return valueNode
  }

  /**
   * Removes item from the values list.
   *
   * @param {string} key
   * */
  removeValue (key) {
    const valueNode = this.findValuesNode(key)

    // Removes item from the values array
    this.selectedOptions = this.selectedOptions.filter((item) => item.key !== key)

    // Removes node from the values container
    valueNode.parentNode.removeChild(valueNode)

    // Adds item to the suggestions list
    this.addOption(valueNode.textContent, key)

    // Dispatches the remove event
    this.events.change.dispatch({
      isMultiple: this.isMultiple,
      value: this.selectedOptions,
      actionType: 'remove',
    })
  }

  /**
   * Removes the last selected option in the list.
   * */
  removeLastValue () {
    // The last label will be right before the search input
    const lastLabelNode = this.nodes.searchNode.previousSibling

    // If the value is null then the are no available options
    // The action will be skipped
    if (!lastLabelNode) return

    this.removeValue(lastLabelNode.getAttribute('key'))
  }

  /**
   * Removes all selected options.
   * */
  removeAllValues () {
    this.selectedOptions = []
    Handsontable.dom.empty(this.nodes.valuesNode)
    this.nodes.valuesNode.appendChild(this.nodes.searchNode)
  }

  /**
   * Resets the search input node.
   * */
  resetSearchInput () {
    if (!isEmptyString(this.lastSearchQuery)) {
      this.searchOptions() // renders all available options
    }

    this.nodes.searchNode.value = ''
    this.lastSearchQuery = null
  }

  /**
   * Resets the selection cursor.
   * */
  resetHover () {
    const hoveredNode = this.findOptionsNode(this.hoveredKey)
    this.hoveredKey = null

    if (hoveredNode) {
      removeClass(hoveredNode, ACTIVE_CLASS_NAMES.hoveredClass.join(' '))
    }
  }

  /**
   * Creates a DOM node for the options list (options div).
   *
   * @param {string} value
   * @param {string} key
   * @return {HTMLElement} optionNode
   * */
  createOptionNode (value, key) {
    const optionNode = document.createElement('div')
    optionNode.innerHTML = `<span>${value}</span>`
    addClass(optionNode, ACTIVE_CLASS_NAMES.optionsItem.join(' '))
    optionNode.setAttribute('key', key)

    optionNode.addEventListener('click', () => {
      this.addValue(value, key, true)
    })

    return optionNode
  }

  /**
   * Hovers the target node.
   *
   * @param {HTMLElement|EventTarget} targetNode
   * */
  hoverOption (targetNode) {
    // Remove attribute from the currently hovered node
    if (this.hoveredKey) {
      this.resetHover()
    }

    // Updates the state value
    this.hoveredKey = targetNode.getAttribute('key')

    // Updates the hovered node
    addClass(targetNode, ACTIVE_CLASS_NAMES.hoveredClass.join(' '))

    // Scrolls to the item if needed
    scrollToSelection(targetNode)
  }

  /**
   * @return {HTMLElement}
   * */
  findOptionsNode (key) {
    return findNode(this.nodes.optionsNode, key)
  }

  /**
   * @return {HTMLElement}
   * */
  findValuesNode (key) {
    return findNode(this.nodes.valuesNode, key)
  }

  /**
   * Moves selection.
   * If position \current+direction\ has no value then the cursor will remain on the same position.
   *
   * @param {number} direction - "1" (down) or "-1" (up)
   * @param {boolean} ignoreMissing - Don't do anything if there's no element at that direction.
   */
  moveSelection (direction, ignoreMissing = false) {
    /*
     * In some cases the predictSelectedNode function
     * may return null.
     *
     * It happens, for example, if the suggestions were not loaded yet.
     */
    const targetNode = this.predictSelectedNode(direction, ignoreMissing)

    if (targetNode) {
      this.hoverOption(targetNode)
    }
  }

  /**
   * Predicts which node is going to be selected next.
   *
   * @param {number} direction - Can be 1 or -1
   * @param {boolean} ignoreMissing
   * @return {HTMLElement|null}
   * */
  predictSelectedNode (direction, ignoreMissing = false) {
    const hoveredNode = this.findOptionsNode(this.hoveredKey)
    let targetNode

    // Select first element if no item currently selected
    if (!hoveredNode) {
      targetNode = this.nodes.optionsNode.firstElementChild

      // Ignore if there are no available options
      if (!targetNode) return null
    } else {
      const { nextSibling: nextNode, previousSibling: prevNode } = hoveredNode

      // Selects the next/previous node
      if (direction === 1) targetNode = nextNode
      else if (direction === -1) targetNode = prevNode

      if (!ignoreMissing && !targetNode) {
        // "Bounces" selection if no elements at that direction
        if (direction === 1) targetNode = prevNode
        else if (direction === -1) targetNode = nextNode
      }

      // Returns hovered node if no nodes in that direction
      return targetNode || hoveredNode
    }

    return targetNode
  }

  /**
   * Removes item from the options list.
   *
   * @param {string} key
   * */
  removeOption (key) {
    if (this.hoveredKey === key) {
      // Select next item in the list
      this.moveSelection(1)
    }

    // Remove current item from the list
    const el = this.findOptionsNode(key)
    if (!el) return

    el.parentNode.removeChild(el)
    this.availableOptions = this.availableOptions.filter((item) => item.key !== key)
  }

  /**
   * Removes all available options.
   * */
  removeAllOptions () {
    this.availableOptions = []
    Handsontable.dom.empty(this.nodes.optionsNode)
  }

  /**
   * Returns instance of an event.
   *
   * @param {string} eventName
   * @return {CustomEvent}
   * */
  getEventInstance (eventName) {
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
  addEventListener (eventName, callback) {
    this.getEventInstance(eventName)?.addCallback(callback)
  }

  /**
   * Replaces all saved callbacks with the passed one.
   *
   * @param {string} eventName
   * @param {function} callback
   * */
  setEventListener (eventName, callback) {
    const event = this.getEventInstance(eventName)
    if (!event) {
      // eslint-disable-next-line no-console
      console.warn('An invalid event called: ', eventName)
      return
    }

    event.clearCallbacks()
    event.addCallback(callback)
  }

  /**
   * Removes an event listener.
   *
   * @param {string} eventName
   * @param {function} callback
   * */
  removeEventListener (eventName, callback) {
    this.getEventInstance(eventName)?.removeCallback(callback)
  }

  /**
   * Removes all active event listeners.
   * */
  clearEventListeners () {
    Object.values(this.events).forEach((event) => {
      event.clearCallbacks()
    })
  }

  /**
   * Shows gray text in the dropdown container.
   *
   * @param {string} message - Message that should be displayed.
   * */
  showMessage (message) {
    // Replaces current message with the new one
    this.nodes.messageNode.textContent = message

    // Displays the message by removing the hidden attribute
    removeClass(this.nodes.messageNode, `${ACTIVE_CLASS_NAMES.messageSpan[0]}--hidden`)
  }

  /**
   * Hides the message text in the dropdown container.
   * */
  hideMessage () {
    addClass(this.nodes.messageNode, `${ACTIVE_CLASS_NAMES.messageSpan[0]}--hidden`)
  }

  /**
   * Sets dropdown to the fetching mode.
   * */
  startFetchingMode () {
    this.isFetching = true
    this.showMessage('Loading options...')
    addClass(this.nodes.containerNode, ACTIVE_CLASS_NAMES.fetchingClass.join(' '))
  }

  /**
   * Sets dropdown to the default mode.
   * */
  stopFetchingMode () {
    this.isFetching = false
    this.hideMessage()
    removeClass(this.nodes.containerNode, ACTIVE_CLASS_NAMES.fetchingClass.join(' '))
  }

  /**
   * Focuses on the search input.
   * */
  focusSearch () {
    this.nodes.searchNode.focus()
  }

  /**
   * Removes all options and clears the options state
   *
   * @public
   * */
  reset () {
    this.isMultiple = true

    this.resetHover()
    this.resetSearchInput()
    this.removeAllValues()
    this.removeAllOptions()
  }

  /**
   * Returns value in the preferable format.
   *
   * @public
   * @return {Array}
   * */
  getValue () {
    return this.selectedOptions.map((item) => item.value)
  }

  /**
   * Adds items to the selectedOptions
   *
   * @public
   * @param {string[]} values
   * */
  setValues (values = []) {
    this.removeAllValues()

    // Breaks the function if no items received
    if (!values.length) return

    // Adds values one by one
    values.forEach((value, key) => {
      this.addValue(value, key.toString())
    })
  }

  show () {
    // Shows the dropdown by resetting the display style value
    this.nodes.parentNode.style.display = ''

    // Focuses on the input field
    // for easier interaction with the dropdown
    this.focusSearch()

    // Scrolls to the top of the suggestions container
    if (this.nodes.options) this.nodes.options.scrollTop = 0
  }

  hide () {
    // Hides the dropdown by changing the display style value
    this.nodes.parentNode.style.display = 'none'
  }
}
