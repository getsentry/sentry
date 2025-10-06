import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

interface Props extends React.ComponentProps<typeof SettingsLayout> {}

function AccountSettingsLayout({children, ...props}: Props) {
  return <SettingsLayout {...props}>{children}</SettingsLayout>;
}

export default AccountSettingsLayout;
