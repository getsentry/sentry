import Alert from 'sentry/components/alert';
import {t} from 'sentry/locale';
import {PageContent} from 'sentry/styles/organization';

function NoAccess() {
  return (
    <PageContent>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </PageContent>
  );
}

export default NoAccess;
