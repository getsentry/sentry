export function isOverflown(el: Element): boolean {
  return el.scrollWidth > el.clientWidth || Array.from(el.children).some(isOverflown);
}
