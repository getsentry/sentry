import {EventBufferManager} from './eventBufferManager';

const MAX_BUFFER_SIZE = 20_000_000; // 20MB in bytes

class EventLogger {
  private bufferManager: EventBufferManager;

  constructor() {
    this.bufferManager = new EventBufferManager(MAX_BUFFER_SIZE);
  }

  logEvent(eventName: string, data?: object) {
    this.bufferManager.addEvent(eventName, data);
  }

  flushEvents() {
    const events = this.bufferManager.flushBuffer();
    // Here you would typically send the events to your backend
    console.log('Flushing events:', events);
  }
}

const eventLogger = new EventLogger();

export function logEvent(eventName: string, data?: object) {
  eventLogger.logEvent(eventName, data);
}

export function flushEvents() {
  eventLogger.flushEvents();
}

// Schedule periodic flushing of events
setInterval(flushEvents, 5 * 60 * 1000); // Flush every 5 minutes
```
