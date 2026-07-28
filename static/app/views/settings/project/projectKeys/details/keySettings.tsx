import {Fragment} from 'react';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Access} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {DateTime} from 'sentry/components/dateTime';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';
import {ProjectKeyCredentials} from 'sentry/views/settings/project/projectKeys/credentials';
import {KeyRateLimitsForm} from 'sentry/views/settings/project/projectKeys/details/keyRateLimitsForm';
import {LoaderSettings} from 'sentry/views/settings/project/projectKeys/details/loaderSettings';

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

const keySettingsSchema = z.object({
  name: z.string(),
  isActive: z.boolean(),
  dateCreated: z.string(),
});

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

  const mutationOptions = {
    mutationFn: (fieldData: Partial<ProjectKey>) =>
      fetchMutation<ProjectKey>({
        url: apiEndpoint,
        method: 'PUT',
        data: fieldData,
      }),
    onSuccess: (updated: ProjectKey) => {
      updateData(updated);
    },
  };

  const handleRemove = async () => {
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
  };

  return (
    <Fragment>
      <Access access={['project:write']} project={project}>
        {({hasAccess}) => (
          <Fragment>
            <FieldGroup title={t('Details')}>
              <AutoSaveForm
                name="name"
                schema={keySettingsSchema}
                initialValue={data.name}
                mutationOptions={mutationOptions}
              >
                {field => (
                  <field.Layout.Row label={t('Name')}>
                    <field.Input
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                      maxLength={64}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
              <AutoSaveForm
                name="isActive"
                schema={keySettingsSchema}
                initialValue={data.isActive}
                mutationOptions={mutationOptions}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Enabled')}
                    hintText={t(
                      'Accept events from this key? This may be used to temporarily suspend a key.'
                    )}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={!hasAccess}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
              <AutoSaveForm
                name="dateCreated"
                schema={keySettingsSchema}
                initialValue={data.dateCreated}
                mutationOptions={mutationOptions}
              >
                {field => (
                  <field.Layout.Row label={t('Created')}>
                    <Text>
                      <DateTime date={field.state.value} />
                    </Text>
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
            </FieldGroup>

            <KeyRateLimitsForm
              organization={organization}
              keyId={params.keyId}
              projectId={params.projectId}
              data={data}
              disabled={!hasAccess}
              project={project}
              updateData={updateData}
            />

            <FieldGroup title={t('JavaScript Loader Script')}>
              <Alert variant="info" system>
                {t('Note that it can take a few minutes until changed options are live.')}
              </Alert>

              <LoaderSettings
                orgSlug={organization.slug}
                keyId={params.keyId}
                project={project}
                data={data}
                updateData={updateData}
              />
            </FieldGroup>

            <Panel>
              <PanelHeader>{t('Credentials')}</PanelHeader>
              <ProjectKeyCredentials
                projectId={`${data.projectId}`}
                data={data}
                showPublicKey
                showSecretKey
                showProjectId
              />
            </Panel>
          </Fragment>
        )}
      </Access>

      <Access access={['project:admin']} project={project}>
        {({hasAccess}) => (
          <FieldGroup title={t('Revoke Key')}>
            <Flex direction="row" gap="xl" align="center" justify="between">
              <Stack gap="xs" flex="1">
                <Text bold>{t('Revoke Key')}</Text>
                <Text size="sm" variant="muted">
                  {t(
                    'Revoking this key will immediately remove and suspend the credentials. This action is irreversible.'
                  )}
                </Text>
              </Stack>
              <Confirm
                priority="danger"
                message={t(
                  'Are you sure you want to revoke this key? This will immediately remove and suspend the credentials.'
                )}
                onConfirm={() => {
                  handleRemove();
                }}
                confirmText={t('Revoke Key')}
                disabled={!hasAccess}
              >
                <Button variant="danger">{t('Revoke Key')}</Button>
              </Confirm>
            </Flex>
          </FieldGroup>
        )}
      </Access>
    </Fragment>
  );
}
