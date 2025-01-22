export default class EventDispatcher implements EventTarget {
  private callbacks = new Map<string, EventListenerOrEventListenerObject[]>();

  public addEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject
  ): void {
    this.callbacks.set(type, (this.callbacks.get(type) ?? []).concat(callback));
  }

  public removeEventListener(
    type: string,
    callback: EventListenerOrEventListenerObject | null
  ): void {
    const callbacks = this.callbacks.get(type) ?? [];
    this.callbacks.set(
      type,
      callbacks.filter(cb => cb !== callback)
    );
  }

  public dispatchEvent(event: Event): boolean {
    this.callbacks.get(event.type)?.forEach(cb => {
      try {
        if ('handleEvent' in cb) {
          cb.handleEvent(event);
        } else {
          cb(event);
        }
      } catch (err) {
        // TODO: A callback failed, but we need to keep going
      }
    });
    return true;
  }
}
