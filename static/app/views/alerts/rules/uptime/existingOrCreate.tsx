import {useEffect} from 'react';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

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
      const url = makeAlertsPathname({
        path: `/uptime-rules/${existingRules[0]?.projectSlug}/${existingRules[0]?.id}/`,
        organization,
      });
      navigate(url, {replace: true});
      return;
    }

    // Has multiple existing alert rules
    if (existingRules.length > 1) {
      const url = makeAlertsPathname({
        path: `/rules/`,
        organization,
      });
      navigate(
        {
          pathname: url,
          query: {
            alertType: CombinedAlertType.UPTIME,
          },
        },
        {replace: true}
      );
      return;
    }

    // No alert rules, create a new one
    const url = makeAlertsPathname({
      path: `/new/uptime/`,
      organization,
    });
    navigate(url, {replace: true});
  }, [existingRules, isPending, navigate, organization]);

  return <LoadingIndicator />;
}
