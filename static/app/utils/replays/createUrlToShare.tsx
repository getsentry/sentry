function createUrlToShare(currentTimeMs: number) {
  const url = new URL(window.location.href);
  const curentTimeSec = Math.floor(msToSec(currentTimeMs) || 0);
  if (curentTimeSec > 0) {
    url.searchParams.set('t', curentTimeSec.toString());
  }
  return url.toString();
}

function msToSec(ms: number) {
  return ms / 1000;
}

export default createUrlToShare;
