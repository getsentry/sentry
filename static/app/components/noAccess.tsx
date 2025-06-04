import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';

export function NoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert.Container>
        <Alert type="warning">{t("You don't have access to this feature")}</Alert>
      </Alert.Container>
    </Layout.Page>
  );
}
