export function computeCenteredWindow(width: number, height: number) {
  const screenLeft = window.screenLeft === undefined ? window.screenX : window.screenLeft;
  const screenTop = window.screenTop === undefined ? window.screenY : window.screenTop;

  const innerWidth = window.innerWidth
    ? window.innerWidth
    : document.documentElement.clientWidth
      ? document.documentElement.clientWidth
      : screen.width;

  const innerHeight = window.innerHeight
    ? window.innerHeight
    : document.documentElement.clientHeight
      ? document.documentElement.clientHeight
      : screen.height;

  const left = innerWidth / 2 - width / 2 + screenLeft;
  const top = innerHeight / 2 - height / 2 + screenTop;

  return {left, top};
}
