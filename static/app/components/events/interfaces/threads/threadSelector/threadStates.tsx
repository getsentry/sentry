import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';

export enum ThreadStates {
  RUNNABLE = 'Runnable',
  TIMED_WAITING = 'Timed waiting',
  BLOCKED = 'Blocked',
  WAITING = 'Waiting',
  NEW = 'New',
  TERMINATED = 'Terminated',
}

type ThreadStatesMap = Record<string, ThreadStates>;

export const javaThreadStatesMap: ThreadStatesMap = {
  RUNNABLE: ThreadStates.RUNNABLE,
  TIMED_WAITING: ThreadStates.TIMED_WAITING,
  BLOCKED: ThreadStates.BLOCKED,
  WAITING: ThreadStates.WAITING,
  NEW: ThreadStates.NEW,
  TERMINATED: ThreadStates.TERMINATED,
  // Android VM thread states https://cs.android.com/android/platform/superproject/+/master:art/runtime/thread_state.h
  kTerminated: ThreadStates.TERMINATED, // Thread.run has returned, but Thread* still around
  kRunnable: ThreadStates.RUNNABLE, // runnable
  kTimedWaiting: ThreadStates.TIMED_WAITING, // in Object.wait() with a timeout
  kSleeping: ThreadStates.TIMED_WAITING, // in Thread.sleep()
  kBlocked: ThreadStates.BLOCKED, // blocked on a monitor
  kWaiting: ThreadStates.WAITING, // in Object.wait()
  kWaitingForLockInflation: ThreadStates.WAITING, // blocked inflating a thin-lock
  kWaitingForTaskProcessor: ThreadStates.WAITING, // blocked waiting for taskProcessor
  kWaitingForGcToComplete: ThreadStates.WAITING, // blocked waiting for GC
  kWaitingForCheckPointsToRun: ThreadStates.WAITING, // GC waiting for checkpoints to run
  kWaitingPerformingGc: ThreadStates.WAITING, // performing GC
  kWaitingForDebuggerSend: ThreadStates.WAITING, // blocked waiting for events to be sent
  kWaitingForDebuggerToAttach: ThreadStates.WAITING, // blocked waiting for debugger to attach
  kWaitingInMainDebuggerLoop: ThreadStates.WAITING, // blocking/reading/processing debugger events
  kWaitingForDebuggerSuspension: ThreadStates.WAITING, // waiting for debugger suspend all
  kWaitingForJniOnLoad: ThreadStates.WAITING, // waiting for execution of dlopen and JNI on load code
  kWaitingForSignalCatcherOutput: ThreadStates.WAITING, // waiting for signal catcher IO to complete
  kWaitingInMainSignalCatcherLoop: ThreadStates.WAITING, // blocking/reading/processing signals
  kWaitingForDeoptimization: ThreadStates.WAITING, // waiting for deoptimization suspend all
  kWaitingForMethodTracingStart: ThreadStates.WAITING, // waiting for method tracing to start
  kWaitingForVisitObjects: ThreadStates.WAITING, // waiting for visiting objects
  kWaitingForGetObjectsAllocated: ThreadStates.WAITING, // waiting for getting the number of allocated objects
  kWaitingWeakGcRootRead: ThreadStates.WAITING, // waiting on the GC to read a weak root
  kWaitingForGcThreadFlip: ThreadStates.WAITING, // waiting on the GC thread flip (CC collector) to finish
  kNativeForAbort: ThreadStates.WAITING, // checking other threads are not run on abort.
  kStarting: ThreadStates.NEW, // native thread started, not yet ready to run managed code
  kNative: ThreadStates.RUNNABLE, // running in a JNI native method
  kSuspended: ThreadStates.RUNNABLE, // suspended by GC or debugger
};

export const THREAD_STATE_TERMS: Record<ThreadStates, string> = {
  [ThreadStates.RUNNABLE]: t(
    'A thread executing in the Java virtual machine is in this state.'
  ),
  [ThreadStates.WAITING]: t(
    'A thread that is waiting indefinitely for another thread to perform a particular action is in this state.'
  ),
  [ThreadStates.TIMED_WAITING]: t(
    'A thread that is waiting for another thread to perform an action for up to a specified waiting time is in this state.'
  ),
  [ThreadStates.BLOCKED]: t(
    'A thread that is blocked waiting for a monitor lock is in this state.'
  ),
  [ThreadStates.NEW]: t('A thread that has not yet started is in this state.'),
  [ThreadStates.TERMINATED]: t('A thread that has exited is in this state.'),
};

export function getThreadStateHelpText(state: keyof typeof THREAD_STATE_TERMS): string {
  if (!THREAD_STATE_TERMS.hasOwnProperty(state)) {
    return '';
  }
  return THREAD_STATE_TERMS[state];
}

export function getMappedThreadState(
  state: string | undefined | null
): ThreadStates | undefined {
  if (defined(state)) {
    return javaThreadStatesMap[state];
  }
  return undefined;
}
