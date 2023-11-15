// The isValidOrgSlug function should match the behaviour of this regular expression:
// ^(?![0-9]+$)[a-zA-Z0-9][a-zA-Z0-9-]*(?<!-)$

// See: https://bugs.webkit.org/show_bug.cgi?id=174931
//
// The ^(?![0-9]+$)[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9]$ regex should almost match the above regex.
const ORG_SLUG_REGEX = new RegExp('^(?![0-9]+$)[a-zA-Z0-9][a-zA-Z0-9-]*$');

function isValidOrgSlug(orgSlug: string): boolean {
  return (
    orgSlug.length > 0 &&
    !orgSlug.startsWith('-') &&
    !orgSlug.endsWith('-') &&
    !orgSlug.includes('_') &&
    ORG_SLUG_REGEX.test(orgSlug)
  );
}

export default isValidOrgSlug;
