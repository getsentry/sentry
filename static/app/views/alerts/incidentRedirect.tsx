import {useCallback, useEffect, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import {browserHistory} from 'react-router';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
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
  const location = useLocation();
  const [hasError, setHasError] = useState(false);

  const track = useCallback(() => {
    trackAnalytics('alert_details.viewed', {
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
          query: {...location.query, alert: incident.identifier},
        })
      );
    } catch (err) {
      setHasError(true);
    }
  }, [setHasError, api, params.alertId, organization, location.query]);

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
