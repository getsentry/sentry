import {useCallback, useEffect, useState} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {trackAnalytics} from 'sentry/utils/analytics';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {fetchIncident} from './utils/apiCalls';
import {alertDetailsLink} from './utils';

/**
 * Reirects from an incident to the incident's metric alert details page
 */
function IncidentRedirect() {
  const organization = useOrganization();
  const params = useParams<{alertId: string}>();
  const api = useApi();
  const location = useLocation();
  const navigate = useNavigate();
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
      navigate(
        normalizeUrl({
          pathname: alertDetailsLink(organization, incident),
          query: {...location.query, alert: incident.identifier},
        }),
        {replace: true}
      );
    } catch {
      setHasError(true);
    }
  }, [navigate, setHasError, api, params.alertId, organization, location.query]);

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
