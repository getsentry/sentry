import {useEffect} from 'react';

import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useLocation} from 'sentry/utils/useLocation';

const issueTrackingFilterKey = 'issueTrackingFilter';

export default function useIssueTrackingFilter() {
  const location = useLocation();
  const issueTrackingQueryParam = location.query.issueTracking;
  const [issueTracking, setIssueTracking] = useLocalStorageState<string>(
    issueTrackingFilterKey,
    'all'
  );
  const issueTrackingFilter = ['', 'all'].includes(issueTracking)
    ? undefined
    : issueTracking;

  useEffect(() => {
    if (typeof issueTrackingQueryParam === 'string') {
      setIssueTracking(issueTrackingQueryParam);
    }
  }, [issueTrackingQueryParam, setIssueTracking]);

  return issueTrackingFilter;
}
