import {Outlet} from 'react-router-dom';

import {useOrganization} from 'sentry/utils/useOrganization';

import {DashboardBasicFeature} from './view';

export default function DashboardsV2Container() {
  const organization = useOrganization();

  return (
    <DashboardBasicFeature organization={organization}>
      <Outlet />
    </DashboardBasicFeature>
  );
}
