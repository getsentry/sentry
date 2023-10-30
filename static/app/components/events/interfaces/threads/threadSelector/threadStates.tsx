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
  Terminated: ThreadStates.TERMINATED, // Thread.run has returned, but Thread* still around
  Runnable: ThreadStates.RUNNABLE, // runnable
  TimedWaiting: ThreadStates.TIMED_WAITING, // in Object.wait() with a timeout
  Sleeping: ThreadStates.TIMED_WAITING, // in Thread.sleep()
  Blocked: ThreadStates.BLOCKED, // blocked on a monitor
  Waiting: ThreadStates.WAITING, // in Object.wait()
  WaitingForLockInflation: ThreadStates.WAITING, // blocked inflating a thin-lock
  WaitingForTaskProcessor: ThreadStates.WAITING, // blocked waiting for taskProcessor
  WaitingForGcToComplete: ThreadStates.WAITING, // blocked waiting for GC
  WaitingForCheckPointsToRun: ThreadStates.WAITING, // GC waiting for checkpoints to run
  WaitingPerformingGc: ThreadStates.WAITING, // performing GC
  WaitingForDebuggerSend: ThreadStates.WAITING, // blocked waiting for events to be sent
  WaitingForDebuggerToAttach: ThreadStates.WAITING, // blocked waiting for debugger to attach
  WaitingInMainDebuggerLoop: ThreadStates.WAITING, // blocking/reading/processing debugger events
  WaitingForDebuggerSuspension: ThreadStates.WAITING, // waiting for debugger suspend all
  WaitingForJniOnLoad: ThreadStates.WAITING, // waiting for execution of dlopen and JNI on load code
  WaitingForSignalCatcherOutput: ThreadStates.WAITING, // waiting for signal catcher IO to complete
  WaitingInMainSignalCatcherLoop: ThreadStates.WAITING, // blocking/reading/processing signals
  WaitingForDeoptimization: ThreadStates.WAITING, // waiting for deoptimization suspend all
  WaitingForMethodTracingStart: ThreadStates.WAITING, // waiting for method tracing to start
  WaitingForVisitObjects: ThreadStates.WAITING, // waiting for visiting objects
  WaitingForGetObjectsAllocated: ThreadStates.WAITING, // waiting for getting the number of allocated objects
  WaitingWeakGcRootRead: ThreadStates.WAITING, // waiting on the GC to read a weak root
  WaitingForGcThreadFlip: ThreadStates.WAITING, // waiting on the GC thread flip (CC collector) to finish
  NativeForAbort: ThreadStates.WAITING, // checking other threads are not run on abort.
  Starting: ThreadStates.NEW, // native thread started, not yet ready to run managed code
  Native: ThreadStates.RUNNABLE, // running in a JNI native method
  Suspended: ThreadStates.RUNNABLE, // suspended by GC or debugger
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
