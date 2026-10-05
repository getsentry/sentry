import {TraceTreeEventDispatcher} from './traceTreeEventDispatcher';

describe('TraceEventDispatcher', () => {
  it('dispatch events', () => {
    const dispatcher = new TraceTreeEventDispatcher();
    const mockCallback = jest.fn();
    dispatcher.on('trace timeline change', mockCallback);
    dispatcher.dispatch('trace timeline change', [0, 1]);
    expect(mockCallback).toHaveBeenCalledWith([0, 1]);
  });

  it('off events', () => {
    const dispatcher = new TraceTreeEventDispatcher();
    const mockCallback = jest.fn();

    dispatcher.on('trace timeline change', mockCallback);
    dispatcher.off('trace timeline change', mockCallback);
    dispatcher.dispatch('trace timeline change', [0, 1]);
    expect(mockCallback).not.toHaveBeenCalled();
  });
});
