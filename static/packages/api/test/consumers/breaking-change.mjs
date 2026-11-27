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

/**
 * The message that names a CI run's change: the PR title on a pull request,
 * the merged commit's message on a push or in the merge queue.
 *
 * @param {any} event A GitHub Actions event payload (`GITHUB_EVENT_PATH`).
 * @returns {string | undefined}
 */
export function changeMessage(event) {
  return event?.pull_request?.title ?? event?.head_commit?.message ?? event?.merge_group?.head_commit?.message;
}
