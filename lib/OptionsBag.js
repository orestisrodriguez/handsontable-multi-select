import Handsontable from "handsontable"
const {addClass} = Handsontable.dom

const KEY_ATTRIBUTE_NAME = "key";

export default class OptionsBag {
  constructor(targetNode, separator) {
    this.separator = separator
    this.selectedOptions = []
    this.selectedKey = null
    this.nodes = {
      targetNode,
      parentNode: targetNode.parentNode,
      containerNode: null,
      inputNode: null,
      optionsNode: null
    }
  }

  /**
   * Adds input and options nodes to the parent.
   * Should be called after class instantiation.
   * */
  renderStructure() {
    const containerNode = this.nodes.containerNode = document.createElement("div")
    addClass(containerNode, "multi-select__editor")

    const inputNode = this.nodes.inputNode = document.createElement("div")
    addClass(inputNode, "multi-select__editor-input")

    const optionsNode = this.nodes.optionsNode = document.createElement("div")
    addClass(optionsNode, "multi-select__editor-options")

    this.nodes.parentNode.appendChild(containerNode)
    containerNode.appendChild(inputNode)
    containerNode.appendChild(optionsNode)
  }

  /**
   * Replaces options with new values.
   *
   * @param {Array|Promise} options
   * @param {string} itemsKey
   * @param {string} itemsValue
   * */
  setOptions(options, itemsKey, itemsValue) {
    this.reset()

    let fetchedOptions = options

    // Resolve the promise and come back
    if (typeof (fetchedOptions.then) === "function") {
      return this.handleAsyncOptions(...arguments)
    }

    // Keep track of keys to prevent keys duplication
    const knownKeys = []

    fetchedOptions.forEach(({[itemsKey]: key, [itemsValue]: value}) => {
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
   * Accepts a Promise and calls the setOptions
   * when the promise is resolved.
   * */
  handleAsyncOptions(optionsPromise, ...args) {
    optionsPromise.then(options => {
      this.setOptions(options, ...args)
    })
  }

  /**
   * Adds option value to the state
   * and removes the item from the options list.
   *
   * @param {string} key
   * @param {string} value
   * */
  addValue(key, value) {
    this.removeOption(key)

    //
    this.selectedOptions.push({key, value})
    this.nodes.inputNode.appendChild(this.createValueNode(value, key))


    // Select previous item in the array.
    this.selectOption(this.selectedKey - 1)
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
    addClass(valueNode, "multi-select__label")
    addClass(valueNode, "controllable")
    valueNode.setAttribute(KEY_ATTRIBUTE_NAME, key)
    valueNode.textContent = value

    // Remove node and value on click
    valueNode.addEventListener('click', () => {
      this.removeValue(key)
    })

    return valueNode
  }

  /**
   * Removes item from the values list.
   *
   * @param {string} key
   * */
  removeValue(key) {
    const el = this.nodes.inputNode.querySelector(`[${KEY_ATTRIBUTE_NAME}="${key}"]`)
    el.parentNode.removeChild(el)
  }

  /**
   * Creates a DOM node for the options list (options div).
   *
   * @param {string} value
   * @param {string} key
   * @return {HTMLElement} optionNode
   * */
  createOptionNode(value, key) {
    const optionNode = document.createElement("span")
    optionNode.innerHTML = `<span>${value}</span><span icon></span>`
    addClass(optionNode, "multi-select__editor-options__item")
    optionNode.setAttribute(KEY_ATTRIBUTE_NAME, key)

    optionNode.addEventListener('mouseenter', () => {
      this.selectOption(key)
    })

    optionNode.addEventListener('click', () => {
      this.addValue(key, value)
    })

    return optionNode
  }

  /**
   * Updates option nodes.
   *
   * @param {string} key
   * */
  selectOption(key) {
    const attrName = "hovered"

    this.selectedKey = key

    this.nodes.optionsNode.children.forEach((io, ia) => {
      if (io.getAttribute(KEY_ATTRIBUTE_NAME) === this.selectedKey) {
        io.setAttribute(attrName, "true")
        return
      }

      if (io.hasAttribute(attrName)) {
        io.removeAttribute(attrName)
      }
    })
  }

  /**
   * Removes item from the options list.
   *
   * @param {string} key
   * */
  removeOption(key) {
    const el = this.nodes.optionsNode.querySelector(`[${KEY_ATTRIBUTE_NAME}="${key}"]`)
    el.parentNode.removeChild(el)
  }

  /**
   * Removes all options and clears the options state
   * */
  reset() {
    this.selectedOptions = []
    this.nodes.optionsNode.innerHTML = ""
  }

  /**
   * Returns value in the preferable format.
   *
   * @return {Array}
   * */
  getValue = () => {
    return this.selectedOptions.map(io => io.value)
  }
}