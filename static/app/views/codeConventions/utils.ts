import {queryOptions, skipToken} from '@tanstack/react-query';
import {parse} from 'yaml';

import {toTitleCase} from 'sentry/utils/string/toTitleCase';

export const REPO = 'getsentry/sentry';
const REF = 'master';
const CONVENTIONS_PATH = '.sentry-refactor-tasks/conventions';

const CONVENTIONS_CONTENTS_URL = `https://api.github.com/repos/${REPO}/contents/${CONVENTIONS_PATH}?ref=${REF}`;

const YAML_EXTENSION = /\.ya?ml$/;

export interface Convention {
  name: string;
  detect?: string;
  detect_command?: string;
  examples?: {bad?: string[]; good?: string[]};
  exclude?: string[];
  fix?: string;
  include?: string[];
  prefilter?: string;
  severity?: string;
  tags?: string[];
  why?: string;
}

interface GitHubContentEntry {
  name: string;
  sha: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
}

// The repo is public, so the unauthenticated GitHub API is enough here. Its
// rate limit is per-IP, so avoid refetching on every focus or remount.
export const conventionFilesQueryOptions = queryOptions({
  queryKey: ['github-contents', CONVENTIONS_CONTENTS_URL],
  queryFn: async ({signal}): Promise<GitHubContentEntry[]> => {
    const response = await fetch(CONVENTIONS_CONTENTS_URL, {
      signal,
      headers: {Accept: 'application/vnd.github+json'},
    });
    if (!response.ok) {
      throw new Error(`GitHub responded with ${response.status}`);
    }
    return response.json();
  },
  select: data =>
    data.filter(entry => entry.type === 'file' && YAML_EXTENSION.test(entry.name)),
  staleTime: 5 * 60 * 1000,
});

export function getConventionFileUrls(filename: string) {
  return {
    htmlUrl: `https://github.com/${REPO}/blob/${REF}/${CONVENTIONS_PATH}/${filename}`,
    rawUrl: `https://raw.githubusercontent.com/${REPO}/${REF}/${CONVENTIONS_PATH}/${filename}`,
  };
}

/**
 * Fetches and parses one convention file. Parsing happens in the query so the
 * table and the drawer share the parsed result from the cache, and a YAML
 * syntax error surfaces as the query's error state.
 */
export function conventionQueryOptions(filename: string | undefined) {
  return queryOptions({
    queryKey: ['github-raw', filename],
    queryFn: filename
      ? async ({signal}): Promise<Convention> => {
          const response = await fetch(getConventionFileUrls(filename).rawUrl, {signal});
          if (!response.ok) {
            throw new Error(`GitHub responded with ${response.status}`);
          }
          return parse(await response.text());
        }
      : skipToken,
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * A convention's `name` field is the same as its filename stem, so the stem is
 * what @sentry/refactor-tasks uses to label its issues.
 */
export function getConventionName(filename: string) {
  return filename.replace(YAML_EXTENSION, '');
}

/**
 * The `[<name>]` prefix that @sentry/refactor-tasks puts on each issue title,
 * used to find a convention's issues.
 */
export function getConventionIssueTitlePrefix(conventionName: string) {
  return `[${conventionName}]`;
}

/**
 * Human-readable title, e.g. `no-class-components` -> `No Class Components`.
 */
export function formatConventionTitle(conventionName: string) {
  return toTitleCase(conventionName.replaceAll('-', ' '));
}

export function getCodeConventionsPath(orgSlug: string) {
  return `/organizations/${orgSlug}/issues/code-conventions/`;
}
