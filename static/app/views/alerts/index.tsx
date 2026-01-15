import {cloneElement, isValidElement} from 'react';

import NoProjectMessage from 'sentry/components/noProjectMessage';
import Redirect from 'sentry/components/redirect';
import useOrganization from 'sentry/utils/useOrganization';
import {useRedirectNavV2Routes} from 'sentry/views/nav/useRedirectNavV2Routes';

type Props = {
  children: React.ReactNode;
};

function AlertsContainer({children}: Props) {
  const organization = useOrganization();

  const content =
    children && isValidElement(children)
      ? cloneElement<any>(children, {
          organization,
        })
      : children;

  const redirectPath = useRedirectNavV2Routes({
    oldPathPrefix: '/alerts/',
    newPathPrefix: '/issues/alerts/',
  });

  if (redirectPath) {
    return <Redirect to={redirectPath} />;
  }

  return <NoProjectMessage organization={organization}>{content}</NoProjectMessage>;
}

export default AlertsContainer;
