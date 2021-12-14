import {cloneElement, Fragment, isValidElement} from 'react';

import {Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
  children: React.ReactNode;
};

function AlertsContainer({organization, children}: Props) {
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

export default withOrganization(AlertsContainer);
