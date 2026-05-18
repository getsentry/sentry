import {findBestThread} from 'sentry/components/events/interfaces/threads/threadSelector/findBestThread';
import type {Event, Thread} from 'sentry/types/event';

export interface IssueThreadStackTraceStore {
  changeThread: (direction: 'previous' | 'next') => void;
  getActiveThread: () => Thread | undefined;
  setActiveThread: (thread: Thread | undefined) => void;
  subscribe: (listener: () => void) => () => void;
  sync: (event: Event, threads: Thread[]) => void;
}

export function createIssueThreadStackTraceStore(
  event: Event,
  initialThreads: Thread[]
): IssueThreadStackTraceStore {
  let eventId = event.id;
  let threads = initialThreads;
  let activeThread = threads.length ? findBestThread(threads) : undefined;
  const listeners = new Set<() => void>();

  function notify() {
    listeners.forEach(listener => listener());
  }

  return {
    changeThread(direction) {
      if (!threads.length) {
        return;
      }

      const currentIndex = threads.findIndex(thread => thread.id === activeThread?.id);
      let nextIndex = direction === 'previous' ? currentIndex - 1 : currentIndex + 1;
      if (nextIndex < 0) {
        nextIndex = threads.length - 1;
      } else if (nextIndex >= threads.length) {
        nextIndex = 0;
      }

      activeThread = threads[nextIndex];
      notify();
    },
    getActiveThread() {
      return activeThread;
    },
    setActiveThread(thread) {
      activeThread = thread;
      notify();
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sync(nextEvent, nextThreads) {
      const previousActiveThreadId = activeThread?.id;
      threads = nextThreads;

      if (eventId !== nextEvent.id) {
        eventId = nextEvent.id;
        activeThread = threads.length ? findBestThread(threads) : undefined;
        return;
      }

      activeThread =
        threads.find(thread => thread.id === previousActiveThreadId) ??
        (threads.length ? findBestThread(threads) : undefined);
    },
  };
}
