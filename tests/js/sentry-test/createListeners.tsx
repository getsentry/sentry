export function createListeners(type: 'window' | 'document') {
  const eventTarget = type === 'window' ? window : document;

  let listeners: Array<Record<string, any>> = [];

  const handler = <K extends keyof GlobalEventHandlersEventMap>(
    eventData: Record<string, any>,
    event: K
  ) => {
    const filteredListeners = listeners.filter(listener =>
      listener.hasOwnProperty(event)
    );

    if (eventData?.key === 'Escape') {
      return filteredListeners[1]?.[event]?.(eventData);
    }

    return filteredListeners[0]?.[event]?.(eventData);
  };

  eventTarget.addEventListener = jest.fn((event, cb) => {
    listeners.push({
      [event]: cb,
    });
  });

  eventTarget.removeEventListener = jest.fn(event => {
    listeners = listeners.filter(listener => !listener.hasOwnProperty(event));
  });

  return {
    mouseDown: (domEl: HTMLElement) => handler({target: domEl}, 'mousedown'),
    keyDown: (key: KeyboardEvent['key']) => handler({key}, 'keydown'),
  };
}
