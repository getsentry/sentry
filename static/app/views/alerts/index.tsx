import {cloneElement, Fragment, isValidElement} from 'react';

import useOrganization from 'sentry/utils/useOrganization';

type Props = {
  children: React.ReactNode;
};

function AlertsContainer({children}: Props) {
  const organization = useOrganization();
  const hasMetricAlerts = organization.features.includes('incidents');

  const content =
    children && isValidElement(children)
      ? cloneElement(children, {
          organization,
          hasMetricAlerts,
        })
      : children;

  return <Fragment>{content}</Fragment>;
}

export default AlertsContainer;
