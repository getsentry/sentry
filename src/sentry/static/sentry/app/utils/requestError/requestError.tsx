export default class RequestError extends Error {
  responseJSON?: any;
  status?: number;
  statusText?: string;

  constructor(method: string | undefined, path: string) {
    super(`${method || 'GET'} ${path}`);
    this.name = 'RequestError';
    Object.setPrototypeOf(this, new.target.prototype);
  }

  /**
   * Updates Error with XHR response
   */
  setResponse(resp: JQueryXHR) {
    if (resp) {
      this.setMessage(
        `${this.message} ${typeof resp.status === 'number' ? resp.status : 'n/a'}`
      );

      // Some callback handlers expect these properties on the error object
      if (resp.responseJSON) {
        this.responseJSON = resp.responseJSON;
      }

      this.status = resp.status;
      this.statusText = resp.statusText;
    }
  }

  setMessage(message: string) {
    this.message = message;
  }

  setStack(newStack: string) {
    this.stack = newStack;
  }

  setName(name: string) {
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
