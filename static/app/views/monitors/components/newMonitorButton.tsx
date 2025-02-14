import type {LinkButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

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
          ? `/organizations/${organization.slug}/alerts/new/crons/`
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
