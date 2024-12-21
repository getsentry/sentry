type Event = {
  type: string;
  data?: object;
  timestamp: number;
};

export class EventBufferManager {
  private buffer: Event[] = [];
  private bufferSize: number = 0;
  private maxBufferSize: number;

  constructor(maxBufferSize: number) {
    this.maxBufferSize = maxBufferSize;
  }

  addEvent(eventType: string, eventData?: object) {
    const event: Event = {
      type: eventType,
      data: eventData,
      timestamp: Date.now(),
    };

    const eventSize = JSON.stringify(event).length;

    if (this.bufferSize + eventSize > this.maxBufferSize) {
      this.handleBufferOverflow();
    }

    this.buffer.push(event);
    this.bufferSize += eventSize;
  }

  private handleBufferOverflow() {
    while (this.bufferSize > this.maxBufferSize * 0.9) {  // Remove events until buffer is 90% full
      const removedEvent = this.buffer.shift();
      if (removedEvent) {
        this.bufferSize -= JSON.stringify(removedEvent).length;
      }
    }
  }

  flushBuffer(): Event[] {
    const events = [...this.buffer];
    this.buffer = [];
    this.bufferSize = 0;
    return events;
  }
}
```
