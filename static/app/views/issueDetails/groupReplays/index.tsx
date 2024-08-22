import type {ComponentProps} from 'react';

import {Alert} from 'sentry/components/alert';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import type GroupReplays from './groupReplays';

type Props = ComponentProps<typeof GroupReplays>;

function renderNoAccess() {
  return (
    <Layout.Page withPadding>
      <Alert type="warning">{t("You don't have access to this feature")}</Alert>
    </Layout.Page>
  );
}

function GroupReplaysContainer(props: Props) {
  const organization = useOrganization();

  return null;
}

export default GroupReplaysContainer;
