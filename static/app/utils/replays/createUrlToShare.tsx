function createUrlToShare(currentTimeMs: number) {
  const url = new URL(window.location.href);
  const currentTimeSec = Math.floor(msToSec(currentTimeMs) || 0);
  if (currentTimeSec > 0) {
    url.searchParams.set('t', currentTimeSec.toString());
  }
  return url.toString();
}

function msToSec(ms: number) {
  return ms / 1000;
}

export default createUrlToShare;
