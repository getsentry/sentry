/**
 * Whether a change is a breaking one, the way Craft reads conventional
 * commits to pick a major bump: `type(scope)!:` at the start of the
 * subject, or a `BREAKING CHANGE:` footer.
 *
 * @param {string | undefined} message A PR title or commit message.
 * @returns {boolean}
 */
export function isBreakingChange(message) {
  return /^\w+(?:\([^)]*\))?!:|^BREAKING[ -]CHANGE:/m.test(message ?? "");
}
