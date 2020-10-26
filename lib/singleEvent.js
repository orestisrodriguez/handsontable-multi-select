export default class SingleEvent {
  constructor (eventKeys = []) {
    this.eventKeys = eventKeys // used to validate the event during the dispatching process
    this.callbacks = []
  }

  /**
   * Saves the target callback.
   * The target function is called when the event is dispatched.
   * */
  addCallback (callback) {
    this.callbacks.push(callback)
  }

  /**
   * Removes a callback from the callbacks array.
   * The passed function will not be called anymore.
   * */
  removeCallback (callback) {
    this.callbacks = this.callbacks.filter((item) => item !== callback)
  }

  /**
   * Dispatches all saved callbacks.
   *
   * @param {object} event
   * */
  dispatch (event) {
    // Validate event keys
    const passedKeys = Object.keys(event)
    const missingKey = this.eventKeys.find((key) => !passedKeys.includes(key))

    if (missingKey) {
      throw new Error(`An incompatible event object. Key "${missingKey}" is missing.`)
    }

    // Invoke all callbacks
    this.callbacks.forEach((callback) => callback(event))
  }
}
