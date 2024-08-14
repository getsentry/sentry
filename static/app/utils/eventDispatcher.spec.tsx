import EventDispatcher from 'sentry/utils/eventDispatcher';

describe('EventDispatcher', () => {
  it('should allow adding event listeners, and triggering events', () => {
    const dispatch = new EventDispatcher();
    const callback = jest.fn();

    dispatch.addEventListener('change', callback);

    dispatch.dispatchEvent(new Event('change'));

    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('should allow adding multiple listeners, and triggering events', () => {
    const dispatch = new EventDispatcher();
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    dispatch.addEventListener('change', callback1);
    dispatch.addEventListener('change', callback2);

    dispatch.dispatchEvent(new Event('change'));

    expect(callback1).toHaveBeenCalledTimes(1);
    expect(callback2).toHaveBeenCalledTimes(1);
  });

  it('should allow removing listeners, triggering events on whats registered', () => {
    const dispatch = new EventDispatcher();
    const callback1 = jest.fn();
    const callback2 = jest.fn();

    dispatch.addEventListener('change', callback1);
    dispatch.addEventListener('change', callback2);
    dispatch.removeEventListener('change', callback1);

    dispatch.dispatchEvent(new Event('change'));

    expect(callback1).not.toHaveBeenCalled();
    expect(callback2).toHaveBeenCalledTimes(1);
  });
});
