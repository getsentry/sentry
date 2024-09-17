import type {LinkButtonProps} from 'sentry/components/button';
import {LinkButton} from 'sentry/components/button';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

export function NewMonitorButton(props: Omit<LinkButtonProps, 'to' | 'external'>) {
  const organization = useOrganization();
  const {selection} = usePageFilters();

  return (
    <LinkButton
      to={{
        pathname: `/organizations/${organization.slug}/crons/create/`,
        query: {project: selection.projects},
      }}
      priority="primary"
      {...props}
    >
      {props.children}
    </LinkButton>
  );
}
