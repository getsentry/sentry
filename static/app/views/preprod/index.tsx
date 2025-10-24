import {Outlet} from 'react-router-dom';

import {Alert} from 'sentry/components/core/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {usePreprodAccess} from 'sentry/utils/usePreprodAccess';

function PreprodContainer() {
  const organization = useOrganization();
  const hasPreprodAccess = usePreprodAccess();

  if (!hasPreprodAccess) {
    return (
      <Layout.Page withPadding>
        <Alert.Container>
          <Alert type="warning" showIcon={false}>
            {t("You don't have access to this feature")}
          </Alert>
        </Alert.Container>
      </Layout.Page>
    );
  }

  return (
    <NoProjectMessage organization={organization}>
      <Outlet />
    </NoProjectMessage>
  );
}

export default PreprodContainer;
