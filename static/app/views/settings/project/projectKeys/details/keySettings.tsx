import {Fragment, useCallback} from 'react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import Access from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import {Panel, PanelAlert, PanelBody, PanelHeader} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import KeyRateLimitsForm from 'sentry/views/settings/project/projectKeys/details/keyRateLimitsForm';
import {LoaderSettings} from 'sentry/views/settings/project/projectKeys/details/loaderSettings';
import ProjectKeyCredentials from 'sentry/views/settings/project/projectKeys/projectKeyCredentials';
import {ProjectKey} from 'sentry/views/settings/project/projectKeys/types';

type Props = {
  data: ProjectKey;
  onRemove: () => void;
  organization: Organization;
  params: {
    keyId: string;
    projectId: string;
  };
  project: Project;
  updateData: (data: ProjectKey) => void;
};

export function KeySettings({
  onRemove,
  organization,
  project,
  params,
  data,
  updateData,
}: Props) {
  const api = useApi();

  const {keyId, projectId} = params;
  const apiEndpoint = `/projects/${organization.slug}/${projectId}/keys/${keyId}/`;

  const handleRemove = useCallback(async () => {
    addLoadingMessage(t('Revoking key\u2026'));

    try {
      await api.requestPromise(
        `/projects/${organization.slug}/${projectId}/keys/${keyId}/`,
        {
          method: 'DELETE',
        }
      );

      onRemove();
      addSuccessMessage(t('Revoked key'));
    } catch (_err) {
      addErrorMessage(t('Unable to revoke key'));
    }
  }, [organization, api, onRemove, keyId, projectId]);

  return (
    <Fragment>
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            <Form
              saveOnBlur
              allowUndo
              apiEndpoint={apiEndpoint}
              apiMethod="PUT"
              initialData={data}
            >
              <Panel>
                <PanelHeader>{t('Details')}</PanelHeader>

                <PanelBody>
                  <TextField
                    name="name"
                    label={t('Name')}
                    disabled={!hasAccess}
                    required={false}
                    maxLength={64}
                  />
                  <BooleanField
                    name="isActive"
                    label={t('Enabled')}
                    required={false}
                    disabled={!hasAccess}
                    help="Accept events from this key? This may be used to temporarily suspend a key."
                  />
                  <FieldGroup label={t('Created')}>
                    <div className="controls">
                      <DateTime date={data.dateCreated} />
                    </div>
                  </FieldGroup>
                </PanelBody>
              </Panel>
            </Form>

            <KeyRateLimitsForm
              organization={organization}
              params={params}
              data={data}
              disabled={!hasAccess}
            />

            <Panel>
              <PanelHeader>{t('JavaScript Loader Script')}</PanelHeader>
              <PanelBody>
                <PanelAlert type="info" showIcon>
                  {t(
                    'Note that it can take a few minutes until changed options are live.'
                  )}
                </PanelAlert>

                <LoaderSettings
                  orgSlug={organization.slug}
                  keyId={params.keyId}
                  project={project}
                  data={data}
                  updateData={updateData}
                />
              </PanelBody>
            </Panel>

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <PanelBody>
                <PanelAlert type="info" showIcon>
                  {t(
                    'Your credentials are coupled to a public and secret key. Different clients will require different credentials, so make sure you check the documentation before plugging things in.'
                  )}
                </PanelAlert>

                <ProjectKeyCredentials
                  projectId={`${data.projectId}`}
                  data={data}
                  showPublicKey
                  showSecretKey
                  showProjectId
                />
              </PanelBody>
            </Panel>
          </Fragment>
        )}
      </Access>

      <Access access={['project:admin']} project={project}>
        {({hasAccess}) => (
          <Panel>
            <PanelHeader>{t('Revoke Key')}</PanelHeader>
            <PanelBody>
              <FieldGroup
                label={t('Revoke Key')}
                help={t(
                  'Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'
                )}
              >
                <div>
                  <Confirm
                    priority="danger"
                    message={t(
                      'Are you sure you want to revoke this key? This will immediately remove and suspend the credentials.'
                    )}
                    onConfirm={handleRemove}
                    confirmText={t('Revoke Key')}
                    disabled={!hasAccess}
                  >
                    <Button priority="danger">{t('Revoke Key')}</Button>
                  </Confirm>
                </div>
              </FieldGroup>
            </PanelBody>
          </Panel>
        )}
      </Access>
    </Fragment>
  );
}
