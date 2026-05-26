import {useEffect} from 'react';

import {useCurrentProjectFromRouteParam} from 'sentry/utils/profiling/hooks/useCurrentProjectFromRouteParam';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getTransactionSummaryBaseUrl} from 'sentry/views/performance/transactionSummary/utils';

export default function ProfileSummaryRedirect() {
  const organization = useOrganization();
  const project = useCurrentProjectFromRouteParam();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    // Don't redirect until the project is loaded (so we know its ID).
    if (!project) {
      return;
    }
    navigate(
      {
        pathname: `${getTransactionSummaryBaseUrl(organization)}/profiles/`,
        query: {
          transaction: location.query.transaction,
          project: project.id,
          environment: location.query.environment,
          statsPeriod: location.query.statsPeriod,
          start: location.query.start,
          end: location.query.end,
          query: location.query.query,
        },
      },
      {replace: true}
    );
  }, [navigate, organization, project, location.query]);

  return null;
}
