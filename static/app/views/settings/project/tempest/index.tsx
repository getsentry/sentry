import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import useOrganization from 'sentry/utils/useOrganization';

export default function TempestSettings() {
  const organization = useOrganization();

  if (!hasTempestAccess(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  return <div>Tempest Settings</div>;
}
