import {queryOptions, skipToken} from '@tanstack/react-query';
import {parse} from 'yaml';

import {t} from 'sentry/locale';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

export const REPO = 'getsentry/sentry';

// The `coding-conventions` project that @sentry/refactor-tasks reports into.
export const CONVENTIONS_PROJECT_ID = '4511567035432960';
const REF = 'master';
const CONVENTIONS_PATH = '.sentry-refactor-tasks/conventions';

const CONVENTIONS_CONTENTS_URL = `https://api.github.com/repos/${REPO}/contents/${CONVENTIONS_PATH}?ref=${REF}`;

const YAML_EXTENSION = /\.ya?ml$/;

export interface Convention {
  name: string;
  detect?: string;
  detect_command?: string;
  examples?: {bad?: string[]; good?: string[]};
  fix?: string;
  prefilter?: string;
  /**
   * Cron expression for how often the convention is scanned.
   */
  schedule?: string;
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

/**
 * GitHub's editor for adding a file to the conventions directory, which opens
 * a PR on commit.
 */
export function getNewConventionFileUrl() {
  return `https://github.com/${REPO}/new/${REF}/${CONVENTIONS_PATH}`;
}

export function getNewConventionPath(orgSlug: string) {
  return `/organizations/${orgSlug}/issues/code-conventions/new/`;
}

export function getConventionFileUrls(filename: string) {
  const path = `${CONVENTIONS_PATH}/${filename}`;
  return {
    htmlUrl: `https://github.com/${REPO}/blob/${REF}/${path}`,
    rawUrl: `https://raw.githubusercontent.com/${REPO}/${REF}/${path}`,
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

/**
 * A convention picks the files to scan with either a grep prefilter or a
 * detect_command script, never both.
 */
export function getConventionCommand(
  convention: Convention
): {command: string; title: string} | undefined {
  if (convention.prefilter) {
    return {command: convention.prefilter, title: t('Prefilter')};
  }
  if (convention.detect_command) {
    return {command: convention.detect_command, title: t('Detect Command')};
  }
  return undefined;
}

// Every convention currently runs on the refactor-tasks workflow's cron
// (.github/workflows/refactor-tasks.yml), in UTC. A convention's own
// `schedule` overrides it.
export const DEFAULT_SCHEDULE = '13 8 * * *';

export function getConventionSchedule(convention: Convention) {
  return convention.schedule ?? DEFAULT_SCHEDULE;
}

/**
 * Search params for a convention's open issues, shared by the table's count
 * and the convention's issues page so the two always agree.
 */
export function getConventionIssuesQuery(conventionName: string) {
  return {
    project: CONVENTIONS_PROJECT_ID,
    query: `is:unresolved title:"*${getConventionIssueTitlePrefix(conventionName)}*"`,
    statsPeriod: '90d',
  };
}

export function getConventionIssuesPath(orgSlug: string, conventionName: string) {
  return `/organizations/${orgSlug}/issues/code-conventions/${conventionName}/issues/`;
}

export function getCodeConventionsPath(orgSlug: string) {
  return `/organizations/${orgSlug}/issues/code-conventions/`;
}
