import {Fragment} from 'react';

import useOrganization from 'sentry/utils/useOrganization';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import AccountSettingsNavigation from 'sentry/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

interface Props extends React.ComponentProps<typeof SettingsLayout> {}

function AccountSettingsLayout({children, ...props}: Props) {
  const organization = useOrganization({allowNull: true}) ?? undefined;

  if (prefersStackedNav()) {
    return (
      <Fragment>
        <AccountSettingsNavigation organization={organization} />
        <SettingsLayout {...props}>{children}</SettingsLayout>
      </Fragment>
    );
  }

  return (
    <SettingsLayout
      {...props}
      renderNavigation={() => <AccountSettingsNavigation organization={organization} />}
    >
      {children}
    </SettingsLayout>
  );
}

export default AccountSettingsLayout;
