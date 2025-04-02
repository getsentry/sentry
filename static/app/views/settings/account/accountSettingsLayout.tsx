import useOrganization from 'sentry/utils/useOrganization';
import {prefersStackedNav} from 'sentry/views/nav/prefersStackedNav';
import AccountSettingsNavigation from 'sentry/views/settings/account/accountSettingsNavigation';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

interface Props extends React.ComponentProps<typeof SettingsLayout> {}

function AccountSettingsLayout({children, ...props}: Props) {
  const organization = useOrganization({allowNull: true}) ?? undefined;

  return (
    <SettingsLayout
      {...props}
      renderNavigation={
        prefersStackedNav()
          ? undefined
          : () => <AccountSettingsNavigation organization={organization} />
      }
    >
      {children}
    </SettingsLayout>
  );
}

export default AccountSettingsLayout;
