export default function getAriaLabel(str: string) {
  const matches = str.match(/\[aria=(.*)\]/g);
  if (!matches) {
    return '';
  }
  const pre = matches[0];
  const start = pre.indexOf('aria="') + 6;
  return pre.substring(start, pre.indexOf('"]', start));
}
