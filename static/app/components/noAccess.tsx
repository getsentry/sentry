import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

export function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}
