import {Fragment} from 'react';

import {openAddTempestCredentialsModal} from 'sentry/actionCreators/modal';
import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {PanelTable} from 'sentry/components/panels/panelTable';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {hasTempestAccess} from 'sentry/utils/tempest/features';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {useFetchTempestCredentials} from 'sentry/views/settings/project/tempest/hooks/useFetchTempestCredentials';
import {useHasTempestWriteAccess} from 'sentry/views/settings/project/tempest/utils/access';

import {CredentialRow} from './CredentialRow';

interface Props {
  organization: Organization;
  project: Project;
}

export default function TempestSettings({organization, project}: Props) {
  const hasWriteAccess = useHasTempestWriteAccess();
  const {data: tempestCredentials, isLoading} = useFetchTempestCredentials(
    organization,
    project
  );

  if (!hasTempestAccess(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('PlayStation')} />
      <SettingsPageHeader
        title={t('PlayStation')}
        action={addNewCredentials(hasWriteAccess, organization, project)}
      />

      <Form
        apiMethod="PUT"
        apiEndpoint={`/organizations/${organization.slug}/`}
        initialData={{
          tempestFetchScreenshots: project.options?.tempestFetchScreenshots,
        }}
        saveOnBlur
        hideFooter
      >
        <JsonForm
          forms={[
            {
              title: t('General Settings'),
              fields: [
                {
                  name: 'tempestFetchScreenshots',
                  type: 'boolean',
                  label: t('Fetch Screenshots'),
                  help: t('Allow Tempest to fetch screenshots for the project.'),
                },
              ],
            },
          ]}
        />
      </Form>

      <PanelTable
        headers={[t('Client ID'), t('Client Secret'), t('Created At'), t('Created By')]}
        isLoading={isLoading}
        isEmpty={!tempestCredentials?.length}
      >
        {tempestCredentials?.map(credential => (
          <CredentialRow key={credential.id} credential={credential} />
        ))}
      </PanelTable>
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
