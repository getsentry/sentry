import type {LinkButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

interface Props extends Omit<LinkButtonProps, 'to' | 'external'> {
  /**
   * TODO(epurkhiser): Remove once crons exists only in alerts
   */
  linkToAlerts?: boolean;
}

export function NewMonitorButton({linkToAlerts, ...props}: Props) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return (
    <LinkButton
      to={{
        pathname: linkToAlerts
          ? makeAlertsPathname({
              path: `/new/crons/`,
              organization,
            })
          : `/organizations/${organization.slug}/crons/create/`,
        query: linkToAlerts ? undefined : {project: selection.projects},
      }}
      priority="primary"
      {...props}
    >
      {props.children}
    </LinkButton>
  );
}
