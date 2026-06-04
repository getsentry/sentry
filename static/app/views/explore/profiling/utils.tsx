import {
  isContinuousProfileReference,
  isTransactionProfileReference,
} from 'sentry/utils/profiling/guards/profile';

export function requestAnimationFrameTimeout(cb: () => void, timeout: number) {
  const rafId = {current: 0};
  const start = performance.now();

  function timer() {
    if (rafId.current) {
      window.cancelAnimationFrame(rafId.current);
    }
    if (performance.now() - start > timeout) {
      cb();
      return;
    }
    rafId.current = window.requestAnimationFrame(timer);
  }

  rafId.current = window.requestAnimationFrame(timer);
  return rafId;
}

export function getProfileTargetId(reference: Profiling.BaseProfileReference): string {
  if (isTransactionProfileReference(reference)) {
    return reference.profile_id;
  }
  if (isContinuousProfileReference(reference)) {
    return reference.profiler_id;
  }
  return reference;
}
