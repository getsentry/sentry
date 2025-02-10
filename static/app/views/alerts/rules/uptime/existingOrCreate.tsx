import {useEffect} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';

import {CombinedAlertType, type UptimeAlert} from '../../types';

/**
 * When no uptime alert rules exist, takes the user to create a new alert. If
 * multiple rules exists redirects them to the listing page. If only a single
 * rule exists, tak them to edit that alert rule.
 *
 * This route is used for docs and marketing purposes.
 */
export default function ExistingOrCreate() {
  const organization = useOrganization();
  const navigate = useNavigate();

  const {data: existingRules, isPending} = useApiQuery<UptimeAlert[]>(
    [
      `/organizations/${organization.slug}/combined-rules/`,
      {query: {alertType: CombinedAlertType.UPTIME}},
    ],
    {staleTime: 300}
  );

  useEffect(() => {
    if (isPending || !existingRules) {
      return;
    }

    // Has one single alert rule
    if (existingRules.length === 1) {
      const url = normalizeUrl(
        `/organizations/${organization.slug}/alerts/uptime-rules/${existingRules[0]?.projectSlug}/${existingRules[0]?.id}/`
      );
      navigate(url, {replace: true});
      return;
    }

    // Has multiple existing alert rules
    if (existingRules.length > 1) {
      const url = normalizeUrl(
        `/organizations/${organization.slug}/alerts/rules/?alertType=uptime`
      );
      navigate(url, {replace: true});
      return;
    }

    // No alert rules, create a new one
    const url = normalizeUrl(`/organizations/${organization.slug}/alerts/new/uptime/`);
    navigate(url, {replace: true});
  }, [existingRules, isPending, navigate, organization.slug]);

  return <LoadingIndicator />;
}
