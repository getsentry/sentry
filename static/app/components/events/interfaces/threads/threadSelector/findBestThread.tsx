import {Thread} from 'sentry/types';

function findBestThread(threads: Thread[]) {
  // search the entire threads list for a crashed thread with stack trace
  return (
    threads.find(thread => thread.crashed) ||
    threads.find(thread => thread.stacktrace) ||
    threads[0]
  );
}

export default findBestThread;
