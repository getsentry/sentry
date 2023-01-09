import {useCallback, useEffect, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {fetchIncident} from './utils/apiCalls';
import {alertDetailsLink} from './utils';

type Props = {
  organization: Organization;
} & RouteComponentProps<{alertId: string}, {}>;

/**
 * Reirects from an incident to the incident's metric alert details page
 */
function IncidentRedirect({organization, params}: Props) {
  const api = useApi();
  const [hasError, setHasError] = useState(false);

  const track = useCallback(() => {
    trackAdvancedAnalyticsEvent('alert_details.viewed', {
      organization,
      alert_id: parseInt(params.alertId, 10),
    });
  }, [organization, params.alertId]);

  const fetchData = useCallback(async () => {
    setHasError(false);

    try {
      const incident = await fetchIncident(api, organization.slug, params.alertId);
      browserHistory.replace(
        normalizeUrl({
          pathname: alertDetailsLink(organization, incident),
          query: {alert: incident.identifier},
        })
      );
    } catch (err) {
      setHasError(true);
    }
  }, [setHasError, api, params.alertId, organization]);

  useEffect(() => {
    fetchData();
    track();
  }, [fetchData, track]);

  if (hasError) {
    return <LoadingError onRetry={fetchData} />;
  }

  return <LoadingIndicator />;
}

export default IncidentRedirect;
