import {renderOnDomReady} from 'sentry/bootstrap/renderOnDomReady';

describe('renderOnDomReady', function () {
  it('immediately runs callback if `document.readyState` is not loading', function () {
    const cb = jest.fn();
    renderOnDomReady(cb);
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it('runs callbacks after `DOMContentLoaded` is fired', function () {
    const cb = jest.fn();
    const cb2 = jest.fn();
    Object.defineProperty(document, 'readyState', {
      configurable: true,
      get() {
        return 'loading';
      },
    });
    renderOnDomReady(cb);
    renderOnDomReady(cb2);
    expect(cb).toHaveBeenCalledTimes(0);

    // Dispatch `DOMContentLoaded` event
    const event = document.createEvent('Event');
    event.initEvent('DOMContentLoaded', true, true);
    document.dispatchEvent(event);

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb2).toHaveBeenCalledTimes(1);

    // Reset `readyState`
    Object.defineProperty(document, 'readyState', {
      get() {
        return 'complete';
      },
    });
  });
});
