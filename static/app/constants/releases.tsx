import {t} from 'sentry/locale';

export enum ReleasesSortOption {
  CRASH_FREE_USERS = 'crash_free_users',
  CRASH_FREE_SESSIONS = 'crash_free_sessions',
  USERS_24_HOURS = 'users_24h',
  SESSIONS_24_HOURS = 'sessions_24h',
  SESSIONS = 'sessions',
  DATE = 'date',
  BUILD = 'build',
  SEMVER = 'semver',
  ADOPTION = 'adoption',
}

/**
 * Sort options available for dashboard release filtering.
 *
 * Note: CRASH_FREE_USERS and CRASH_FREE_SESSIONS are intentionally excluded.
 * These options are only shown in the releases list page where there's a
 * "display mode" toggle (users vs sessions) that determines which one to show.
 * See: static/app/views/releases/list/releasesSortOptions.tsx
 */
export const RELEASES_SORT_OPTIONS = {
  [ReleasesSortOption.SESSIONS_24_HOURS]: t('Active Sessions'),
  [ReleasesSortOption.USERS_24_HOURS]: t('Active Users'),
  [ReleasesSortOption.ADOPTION]: t('Adoption'),
  [ReleasesSortOption.BUILD]: t('Build Number'),
  [ReleasesSortOption.DATE]: t('Date Created'),
  [ReleasesSortOption.SEMVER]: t('Semantic Version'),
  [ReleasesSortOption.SESSIONS]: t('Total Sessions'),
} as const;
