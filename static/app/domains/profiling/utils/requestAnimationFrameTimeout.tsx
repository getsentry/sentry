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
