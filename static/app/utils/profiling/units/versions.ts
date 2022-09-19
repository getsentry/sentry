/**
 * Semantic Versioning Comparing
 * #see https://semver.org/
 * #see https://stackoverflow.com/a/65687141/456536
 * #see https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Intl/Collator/Collator#options
 * Taken from https://gist.github.com/iwill/a83038623ba4fef6abb9efca87ae9ccb
 * returns -1 for smaller, 0 for equals, and 1 for greater than
 */
export function semverCompare(a: string, b: string): number {
  if (a.startsWith(b + '-')) {
    return -1;
  }
  if (b.startsWith(a + '-')) {
    return 1;
  }
  return a.localeCompare(b, undefined, {
    numeric: true,
    sensitivity: 'case',
    caseFirst: 'upper',
  });
}
