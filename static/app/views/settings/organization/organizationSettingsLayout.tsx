import {Fragment} from 'react';

import {usePrefersStackedNav} from 'sentry/components/nav/prefersStackedNav';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';
import OrganizationSettingsNavigation from 'sentry/views/settings/organization/organizationSettingsNavigation';

type Props = RouteComponentProps & {
  children: React.ReactNode;
};

function OrganizationSettingsLayout(props: Props) {
  const prefersStackedNav = usePrefersStackedNav();

  if (prefersStackedNav) {
    return (
      <Fragment>
        <OrganizationSettingsNavigation />
        <SettingsLayout {...props} />
      </Fragment>
    );
  }

  return (
    <SettingsLayout
      {...props}
      renderNavigation={() => <OrganizationSettingsNavigation />}
    />
  );
}

export default OrganizationSettingsLayout;
