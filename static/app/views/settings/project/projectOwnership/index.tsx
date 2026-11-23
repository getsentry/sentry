import {useTheme} from '@emotion/react';
import {IconEdit} from '@sentry/icons/edit';
import {useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {useModal, closeModal} from '@sentry/scraps/modal';

import {openEditOwnershipRules} from 'sentry/actionCreators/modal';
import {Access, hasEveryAccess} from 'sentry/components/acl/access';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {IssueOwnership} from 'sentry/types/group';
import type {CodeOwner} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {AddCodeOwnerModal} from './addCodeOwnerModal';
import {CodeOwnerErrors} from './codeownerErrors';
import {CodeOwnerFileTable} from './codeOwnerFileTable';
import {OwnershipRulesTable} from './ownershipRulesTable';

const ownershipSchema = z.object({
  autoAssignment: z.string(),
  codeownersAutoSync: z.boolean(),
});

export default function ProjectOwnership() {
  const {openModal} = useModal();

  const theme = useTheme();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const ownershipTitle = t('Ownership Rules');
  const {project} = useProjectSettingsOutlet();

  const ownershipOptions = apiOptions.as<IssueOwnership>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/ownership/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: Infinity,
    }
  );
  const {
    data: ownership,
    isPending: isOwnershipPending,
    isError: isOwnershipError,
  } = useQuery(ownershipOptions);

  const codeownersOptions = apiOptions.as<CodeOwner[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/codeowners/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      query: {expand: ['codeMapping', 'ownershipSyntax']},
      staleTime: Infinity,
    }
  );
  const {
    data: codeowners = [],
    isLoading: isCodeownersLoading,
    isError: isCodeownersError,
  } = useQuery({
    ...codeownersOptions,
    enabled: organization.features.includes('integrations-codeowners'),
  });

  const handleOwnershipSave = (newOwnership: IssueOwnership) => {
    queryClient.setQueryData(ownershipOptions.queryKey, oldData => ({
      ...oldData,
      json: newOwnership,
      headers: oldData?.headers ?? {},
    }));
    closeModal();
  };

  const handleCodeOwnerAdded = (data: CodeOwner) => {
    queryClient.setQueryData(codeownersOptions.queryKey, oldData => ({
      ...oldData,
      json: [data, ...(oldData?.json ?? [])],
      headers: oldData?.headers ?? {},
    }));
  };

  const handleCodeOwnerDeleted = (data: CodeOwner) => {
    queryClient.setQueryData(codeownersOptions.queryKey, oldData => ({
      ...oldData,
      json: (oldData?.json ?? []).filter(codeowner => codeowner.id !== data.id),
      headers: oldData?.headers ?? {},
    }));
  };

  const handleCodeOwnerUpdated = (data: CodeOwner) => {
    queryClient.setQueryData(codeownersOptions.queryKey, oldData => {
      const existingCodeowners = oldData?.json ?? [];
      const index = existingCodeowners.findIndex(item => item.id === data.id);
      return {
        ...oldData,
        json: [
          ...existingCodeowners.slice(0, index),
          data,
          ...existingCodeowners.slice(index + 1),
        ],
        headers: oldData?.headers ?? {},
      };
    });
  };

  const handleAddCodeOwner = () => {
    openModal(modalProps => (
      <AddCodeOwnerModal
        {...modalProps}
        organization={organization}
        project={project}
        onSave={handleCodeOwnerAdded}
      />
    ));
  };

  const disabled = !hasEveryAccess(['project:write'], {organization, project});
  const editOwnershipRulesDisabled = !hasEveryAccess(['project:read'], {
    organization,
    project,
  });
  const hasCodeowners = organization.features?.includes('integrations-codeowners');

  const ownershipMutationOptions = {
    mutationFn: (data: Partial<z.infer<typeof ownershipSchema>>) =>
      fetchMutation({
        url: getApiUrl('/projects/$organizationIdOrSlug/$projectIdOrSlug/ownership/', {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
        method: 'PUT',
        data,
      }),
    onSuccess: () => queryClient.invalidateQueries({queryKey: ownershipOptions.queryKey}),
  };

  if (isOwnershipPending || isCodeownersLoading) {
    return <LoadingIndicator />;
  }

  const actionButtons = (
    <Grid flow="column" align="center" gap="md">
      {hasCodeowners && (
        <Access access={['org:integrations']} project={project}>
          {({hasAccess}) => (
            <Button
              onClick={handleAddCodeOwner}
              size="md"
              data-test-id="add-codeowner-button"
              disabled={!hasAccess}
            >
              {t('Import CODEOWNERS')}
            </Button>
          )}
        </Access>
      )}
      <Button
        size="md"
        icon={<IconEdit />}
        variant="primary"
        onClick={() =>
          openEditOwnershipRules({
            organization,
            project,
            ownership: ownership!,
            onSave: handleOwnershipSave,
            theme,
          })
        }
        disabled={!!ownership && editOwnershipRulesDisabled}
      >
        {t('Edit Rules')}
      </Button>
    </Grid>
  );

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/ownership/">
      <SentryDocumentTitle title={routeTitleGen(ownershipTitle, project.slug, false)}>
        <SettingsPageHeader
          title={t('Ownership Rules')}
          subtitle={tct(
            'Auto-assign issues to users and teams. To learn more, [link:read the docs].',
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
              ),
            }
          )}
        />
        <ProjectPermissionAlert
          access={editOwnershipRulesDisabled ? ['project:write'] : ['project:read']}
          project={project}
        />
        {isCodeownersError && (
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {t(
                "There was an error loading this project's codeowners. If this issue persists, consider importing it again."
              )}
            </Alert>
          </Alert.Container>
        )}
        <CodeOwnerErrors
          orgSlug={organization.slug}
          projectSlug={project.slug}
          codeowners={codeowners ?? []}
        />
        <Stack gap="xl">
          {ownership && (
            <ErrorBoundary mini>
              <OwnershipRulesTable
                projectRules={ownership.schema?.rules ?? []}
                codeowners={codeowners ?? []}
                actions={actionButtons}
              />
            </ErrorBoundary>
          )}
          <ProjectPermissionAlert project={project} />
          {hasCodeowners && (
            <CodeOwnerFileTable
              project={project}
              codeowners={codeowners ?? []}
              onDelete={handleCodeOwnerDeleted}
              onUpdate={handleCodeOwnerUpdated}
              disabled={disabled}
            />
          )}
          {ownership && !isOwnershipError ? (
            <FieldGroup title={t('Issue Owners')}>
              <AutoSaveForm
                name="autoAssignment"
                schema={ownershipSchema}
                initialValue={ownership.autoAssignment}
                mutationOptions={ownershipMutationOptions}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Prioritize Auto Assignment')}
                    hintText={t(
                      "When there's a conflict between suspect commit and ownership rules."
                    )}
                  >
                    <field.Select
                      value={field.state.value}
                      onChange={field.handleChange}
                      disabled={disabled}
                      options={[
                        {
                          value: 'Auto Assign to Suspect Commits',
                          label: t('Auto-assign to suspect commits'),
                        },
                        {
                          value: 'Auto Assign to Issue Owner',
                          label: t('Auto-assign to issue owner'),
                        },
                        {
                          value: 'Turn off Auto-Assignment',
                          label: t('Turn off auto-assignment'),
                        },
                      ]}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
              <AutoSaveForm
                name="codeownersAutoSync"
                schema={ownershipSchema}
                initialValue={ownership.codeownersAutoSync}
                mutationOptions={ownershipMutationOptions}
              >
                {field => (
                  <field.Layout.Row
                    label={t('Sync changes from CODEOWNERS')}
                    hintText={t(
                      'We\u2019ll update any changes you make to your CODEOWNERS files during a release.'
                    )}
                  >
                    <field.Switch
                      checked={field.state.value}
                      onChange={field.handleChange}
                      disabled={disabled || !(codeowners || []).length}
                    />
                  </field.Layout.Row>
                )}
              </AutoSaveForm>
            </FieldGroup>
          ) : (
            <Alert.Container>
              <Alert variant="danger" showIcon={false}>
                {t('There was an error issue owner settings.')}
              </Alert>
            </Alert.Container>
          )}
        </Stack>
      </SentryDocumentTitle>
    </FormSearch>
  );
}
