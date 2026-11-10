import {useEffect} from 'react';
import {useQueryState} from 'nuqs';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';

const issueTrackingFilterKey = 'issueTrackingFilter';

export function useIssueTrackingFilter() {
  const [issueTrackingQueryParam] = useQueryState('issueTracking');
  const [issueTracking, setIssueTracking] = useLocalStorageState(
    issueTrackingFilterKey,
    'all'
  );
  const issueTrackingFilter = ['', 'all'].includes(issueTracking)
    ? undefined
    : issueTracking;

  useEffect(() => {
    if (issueTrackingQueryParam !== null) {
      setIssueTracking(issueTrackingQueryParam);
    }
  }, [issueTrackingQueryParam, setIssueTracking]);

  return issueTrackingFilter;
}
