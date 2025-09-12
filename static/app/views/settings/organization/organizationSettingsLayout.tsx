import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import SettingsLayout from 'sentry/views/settings/components/settingsLayout';

type Props = RouteComponentProps & {
  children: React.ReactNode;
};

function OrganizationSettingsLayout(props: Props) {
  return <SettingsLayout {...props} />;
}

export default OrganizationSettingsLayout;
