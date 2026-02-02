import type {LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';

import useOrganization from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';

interface Props extends Omit<LinkButtonProps, 'to' | 'external'> {}

export function NewMonitorButton(props: Props) {
  const organization = useOrganization();

  return (
    <LinkButton
      to={makeAlertsPathname({path: `/new/crons/`, organization})}
      priority="primary"
      {...props}
    >
      {props.children}
    </LinkButton>
  );
}
