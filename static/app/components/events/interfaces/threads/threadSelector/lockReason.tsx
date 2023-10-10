import {Lock, LockType} from 'sentry/types';
import {defined} from 'sentry/utils';

export function getLockReason(
  heldLocks?: Record<string, Lock> | null
): string | undefined {
  if (!defined(heldLocks)) {
    return undefined;
  }

  const values = Object.values(heldLocks);
  if (values.length === 0) {
    return undefined;
  }

  const firstLock = values[0] as Lock;
  if (!defined(firstLock)) {
    return undefined;
  }

  const address = firstLock?.address ?? 'unknown object';
  const tid = firstLock?.thread_id;
  let reason: string | undefined;

  switch (firstLock.type) {
    case LockType.LOCKED:
      reason = `locked <${address}>`;
      break;
    case LockType.WAITING:
      reason = `waiting on <${address}>`;
      break;
    case LockType.SLEEPING:
      reason = `sleeping on <${address}>`;
      break;
    case LockType.BLOCKED:
      reason =
        `waiting to lock <${address}>` + (defined(tid) ? ` held by thread ${tid}` : '');
      break;
    default:
      reason = undefined;
  }
  return reason;
}
