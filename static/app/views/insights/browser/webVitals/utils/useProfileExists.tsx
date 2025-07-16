import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';

/**
 * Query results for whether a given replayId exists in the database (not deleted, etc)
 */
export default function useProfileExists(ids: string[]) {
  const result = useSpans(
    {
      search: `profile.id:[${ids.join(',')}]`,
      fields: ['profile.id'],
      enabled: !!ids.length,
      limit: 100,
    },
    'api.performance.browser.web-vitals.profile-exists'
  );

  const profileExists = (id: string) => {
    if (!ids.length) {
      return false;
    }
    return !!result?.data?.some(row => row['profile.id'] === id);
  };
  return {profileExists};
}
