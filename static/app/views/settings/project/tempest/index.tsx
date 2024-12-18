import {Fragment} from 'react';

import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

interface Props {
  organization: Organization;
  project: Project;
}

export default function TempestSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();

  if (!hasTempestAccess(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Playstation')} />
      <SettingsPageHeader
        title={t('Playstation')}
        action={addNewCredentials(hasWriteAccess, organization, project)}
      />
    </Fragment>
  );
}

const addNewCredentials = (
  hasWriteAccess: boolean,
  organization: Organization,
  project: Project
) => (
  <Tooltip
    title={t('You must be an organization admin to add new credentials.')}
    disabled={hasWriteAccess}
  >
    <Button
      priority="primary"
      size="sm"
      data-test-id="create-new-credentials"
      disabled={!hasWriteAccess}
      onClick={() => openAddTempestCredentialsModal({organization, project})}
    >
      {t('Add Credentials')}
    </Button>
  </Tooltip>
);
