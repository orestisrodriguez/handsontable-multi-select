import Handsontable from 'handsontable'
import SingleEvent from './singleEvent'

const { addClass, removeClass } = Handsontable.dom
const { KEY_CODES } = Handsontable.helper

const KEY_ATTRIBUTE_NAME = 'key'
const ACTIVE_CLASS_NAMES = {
  container: [ 'multi-select__choices' ],
  valuesContainer: [ 'multi-select__choices__inner multi-select__choices__list--multiple' ],
  searchInput: [ 'multi-select__choices__input' ],
  options: [ 'multi-select__choices__list', 'multi-select__choices__list--dropdown' ],
  optionsItem: [ 'multi-select__choices__item', 'multi-select__choices__item--single', 'multi-select__choices__item--selectable', 'multi-select__choices__item--choice' ],
  spinnerSpan: [ 'multi-select__choices__item', 'multi-select__choices__item--disabled' ],
  valueLabel: [ 'multi-select__choices__item' ],
}

const isEmptyString = (s) => !s?.trim()

const normalizeOptions = (keyLabel, valueLabel) => (options) => (
  options.map((item) => ({
    key: item[keyLabel].toString(),
    value: item[valueLabel].toString(),
  }))
)

function findNode (libraryNode, key) {
  return libraryNode.querySelector(`[${KEY_ATTRIBUTE_NAME}="${key}"]`)
}

function scrollToSelection (targetChild) {
  const { top: ctop, bottom: cbottom } = targetChild.parentNode.getBoundingClientRect()
  let { top: etop, bottom: ebottom, height: eheight } = targetChild.getBoundingClientRect()

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

const NODE_CREATORS = {
  createOptionsNode () {
    const optionsNode = document.createElement('div')
    addClass(optionsNode, ACTIVE_CLASS_NAMES.options.join(' '))

    return optionsNode
  },
  createSpinnerNode () {
    const spinnerNode = document.createElement('span')
    addClass(spinnerNode, ACTIVE_CLASS_NAMES.spinnerSpan.join(' '))
    spinnerNode.textContent = 'Loading options...'

    return spinnerNode
  },
  createValuesNode (searchNode) {
    const valuesNode = document.createElement('div')
    addClass(valuesNode, ACTIVE_CLASS_NAMES.valuesContainer.join(' '))
    valuesNode.appendChild(searchNode)

    // Focus on the search input if user is not attempting to remove a value
    valuesNode.addEventListener('click', ({ target }) => {
      const isLabel = target.classList.contains(ACTIVE_CLASS_NAMES.valueLabel[0])
      if (!isLabel) {
        searchNode.focus()
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
      const { target, keyCode } = event

      // If backspace + empty field -> remove the last value
      switch (keyCode) {
        case KEY_CODES.BACKSPACE:
          if (isEmptyString(target.value)) this.removeLastValue()
          break
        case KEY_CODES.ARROW_UP:
        case KEY_CODES.ARROW_DOWN:
        case KEY_CODES.ENTER:
          this.events.explicitKeydown.dispatch({ event })
          break
        default:
          break
      }
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
     * Dictionary of node elements that
     * are used to control the dropdown.
     *
     * @type{object}
     * */
    this.nodes = {
      targetNode: textareaNode,
      parentNode: textareaNode.parentNode,
      containerNode: null,
      valuesNode: null,
      optionsNode: null,
      spinnerNode: null,
      searchNode: null,
    }

    /**
     * List of all available events and their handlers.
     *
     * @type{object}
     * */
    this.events = {
      change: new SingleEvent([ 'isMultiple', 'actionType', 'value' ]),
      explicitKeydown: new SingleEvent([ 'event' ]),
    }

    /**
     * Rebinds node creators so that this context
     * would always point to the dropdown instance
     * */
    for (const key in NODE_CREATORS) {
      NODE_CREATORS[key] = NODE_CREATORS[key].bind(this)
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
    const containerNode = NODE_CREATORS.createContainerNode()
    this.nodes.containerNode = containerNode

    const searchNode = NODE_CREATORS.createSearchNode()
    this.nodes.searchNode = searchNode

    const valuesNode = NODE_CREATORS.createValuesNode(searchNode)
    this.nodes.valuesNode = valuesNode

    const optionsNode = NODE_CREATORS.createOptionsNode()
    this.nodes.optionsNode = optionsNode

    const spinnerNode = NODE_CREATORS.createSpinnerNode()
    this.nodes.spinnerNode = spinnerNode

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
   * @param {object} itemKeys - object with two keys - "key" and "value". The values will be used
   * as keys for the option items.
   * @param {object} cellArguments - information about the active cell.
   * */
  setOptions (options, itemKeys, cellArguments) {
    const { key: itemsKey, value: itemsValue } = itemKeys

    // Force options argument to be a function
    // so it'd be easier to process it later
    const fetchOptions = (options.constructor === Function)
      ? options
      : () => options

    // Show loading spinner
    this.showSpinner()

    // Handle promise and render items based on the normalized values
    Promise.resolve(fetchOptions(cellArguments, cellArguments.originalValue))
      .then(normalizeOptions(itemsKey, itemsValue))
      .then((normalizedOptions) => {
        this.availableOptions = normalizedOptions
        return normalizedOptions
      })
      .then(this.renderOptionNodes.bind(this))
      .then(this.hideSpinner.bind(this))
  }

  /**
   * Adds option and pushes it into the DOM tree.
   *
   * @param {string} value
   * @param {string} key
   * */
  addOption (value, key) {
    // Construct an object item
    const optionInfo = { value, key }

    // Push to the options list
    this.availableOptions.push(optionInfo)
    this.renderOptionNodes([ optionInfo ], false)

    // Refresh the list if user is searching for something
    if (this.lastSearchQuery) {
      this.searchOptions(this.lastSearchQuery)
    }
  }

  /**
   * Creates and adds items (nodes) to the options container.
   *
   * @param {Array} options
   * @param {boolean} doResetTree
   * */
  renderOptionNodes (options, doResetTree = true) {
    this.hoveredKey = null

    if (doResetTree) {
      // Clear the list before pushing new values
      Handsontable.dom.empty(this.nodes.optionsNode)
    }

    // Save keys as we iterate to prevent keys duplication
    const knownKeys = []

    options.forEach(({ value, key }) => {
      // Doesn't process the item if the option with the key is selected
      if (this.selectedOptions.some((item) => item.value === value)) return

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

    this.renderOptionNodes(filteredOptions, true)
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
   * the function, to prevent stack overflow (infinite recursion).
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
    valueNode.setAttribute(KEY_ATTRIBUTE_NAME, key)
    valueNode.textContent = value

    // Remove node and value on click
    valueNode.addEventListener('click', () => {
      this.removeValue(key)
      this.events.change.dispatch({
        isMultiple: this.isMultiple,
        value: this.selectedOptions,
        actionType: 'remove',
      })
    })

    return valueNode
  }

  /**
   * Removes item from the values list.
   *
   * @param {string} key
   * */
  removeValue (key) {
    const el = this.findValuesNode(key)

    this.selectedOptions = this.selectedOptions.filter((item) => item.key !== key)
    el.parentNode.removeChild(el)

    this.addOption(el.textContent, key)
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

    this.removeValue(lastLabelNode.getAttribute(KEY_ATTRIBUTE_NAME))
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
   * Creates a DOM node for the options list (options div).
   *
   * @param {string} value
   * @param {string} key
   * @return {HTMLElement} optionNode
   * */
  createOptionNode (value, key) {
    const optionNode = document.createElement('div')
    optionNode.innerHTML = `<span>${value}</span><span icon></span>`
    addClass(optionNode, ACTIVE_CLASS_NAMES.optionsItem.join(' '))
    optionNode.setAttribute(KEY_ATTRIBUTE_NAME, key)

    optionNode.addEventListener('mouseenter', ({ target }) => {
      this.hoverOption(target)
    })

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
    const hoveredClass = 'is-highlighted'

    // Remove attribute from the currently hovered node
    if (this.hoveredKey) {
      removeClass(
        this.findOptionsNode(this.hoveredKey),
        hoveredClass
      )
    }

    // Update the state value
    this.hoveredKey = targetNode.getAttribute(KEY_ATTRIBUTE_NAME)
    // Update the hovered node
    addClass(targetNode, hoveredClass)

    // Scroll if needed
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
    const targetNode = this.predictSelectedNode(direction, ignoreMissing)

    // Resets the variable if there are no options left
    if (targetNode) this.hoverOption(targetNode)
  }

  /**
   * Predicts which node will be selected next.
   *
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

      targetNode = (direction === 1)
        ? nextNode
        : prevNode

      // "Bounce" if there are no elements at that direction
      if (!ignoreMissing && !targetNode) {
        targetNode = (direction === 1)
          ? prevNode
          : nextNode
      }
    }

    return targetNode
  }

  /**
   * Removes item from the options list.
   *
   * @param {string} key
   * */
  removeOption (key) {
    // Select next item in the list
    this.moveSelection(1)

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
   * Removes an event listener.
   *
   * @param {string} eventName
   * @param {function} callback
   * */
  removeEventListener (eventName, callback) {
    this.getEventInstance(eventName)?.removeCallback(callback)
  }

  /**
   * Shows loading spinner in the dropdown container.
   * */
  showSpinner () {
    removeClass(this.nodes.spinnerNode, `${ACTIVE_CLASS_NAMES.spinnerSpan[0]}--hidden`)
  }

  /**
   * Hides spinner in the dropdown container.
   * */
  hideSpinner () {
    addClass(this.nodes.spinnerNode, `${ACTIVE_CLASS_NAMES.spinnerSpan[0]}--hidden`)
  }

  /**
   * Removes all options and clears the options state
   *
   * @public
   * */
  reset () {
    this.hoveredKey = null
    this.isMultiple = true

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

    values.forEach((value, key) => {
      this.addValue(value, key.toString())
    })
  }
}
