export function transformSelectorQuery(selector: string) {
  return selector
    .replaceAll('"', `\\"`)
    .replaceAll('aria=', 'aria-label=')
    .replaceAll('testid=', 'data-test-id=')
    .replaceAll(':', '\\:')
    .replaceAll('*', '\\*');
}
