export const REPO = 'getsentry/sentry';
const REF = 'master';
const CONVENTIONS_PATH = '.sentry-refactor-tasks/conventions';

export const CONVENTIONS_CONTENTS_URL = `https://api.github.com/repos/${REPO}/contents/${CONVENTIONS_PATH}?ref=${REF}`;

export const YAML_EXTENSION = /\.ya?ml$/;

export function getConventionFileUrls(filename: string) {
  return {
    htmlUrl: `https://github.com/${REPO}/blob/${REF}/${CONVENTIONS_PATH}/${filename}`,
    rawUrl: `https://raw.githubusercontent.com/${REPO}/${REF}/${CONVENTIONS_PATH}/${filename}`,
  };
}

// Matches the `[<name>]` prefix that @sentry/refactor-tasks puts on each issue
// title, so rows line up with what shows in the issue stream. A convention's
// `name` field is the same as its filename stem.
export function formatConventionTitle(filename: string) {
  return `[${filename.replace(YAML_EXTENSION, '')}]`;
}

export function getCodeConventionsPath(orgSlug: string) {
  return `/organizations/${orgSlug}/issues/code-conventions/`;
}
