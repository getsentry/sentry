export default class RequestError extends Error {
  constructor(method, path) {
    super(`${method || 'GET'} ${path}`);
    this.name = 'RequestError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Updates Error with XHR response
   */
  setResponse(resp) {
    if (resp) {
      this.setMessage(
        `${this.message} ${resp.status !== 'undefined' ? resp.status : 'n/a'}`
      );

      // Some callback handlers expect these properties on the error object
      if (resp.responseJSON) {
        this.responseJSON = resp.responseJSON;
      }

      this.status = resp.status;
      this.statusText = resp.statusText;
    }
  }

  setMessage(message) {
    this.message = message;
  }

  setStack(newStack) {
    this.stack = newStack;
  }

  setName(name) {
    this.name = name;
  }

  removeFrames(numLinesToRemove) {
    // Drop some frames so stacktrace starts at callsite
    //
    // Note that babel will add a call to support extending Error object

    // Old browsers may not have stacktrace
    if (!this.stack) {
      return;
    }

    const lines = this.stack.split('\n');
    this.stack = [lines[0], ...lines.slice(numLinesToRemove)].join('\n');
  }
}
