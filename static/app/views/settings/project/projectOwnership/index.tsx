import {useTheme} from '@emotion/react';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {AutoSaveField, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Grid} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';

import {closeModal, openEditOwnershipRules, openModal} from 'sentry/actionCreators/modal';
import Access, {hasEveryAccess} from 'sentry/components/acl/access';
import ErrorBoundary from 'sentry/components/errorBoundary';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IssueOwnership} from 'sentry/types/group';
import type {CodeOwner} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {
  fetchMutation,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
  type ApiQueryKey,
} from 'sentry/utils/queryClient';
import routeTitleGen from 'sentry/utils/routeTitle';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import AddCodeOwnerModal from 'sentry/views/settings/project/projectOwnership/addCodeOwnerModal';
import {CodeOwnerErrors} from 'sentry/views/settings/project/projectOwnership/codeownerErrors';
import {CodeOwnerFileTable} from 'sentry/views/settings/project/projectOwnership/codeOwnerFileTable';
import {OwnershipRulesTable} from 'sentry/views/settings/project/projectOwnership/ownershipRulesTable';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

const ownershipSchema = z.object({
  autoAssignment: z.string(),
  codeownersAutoSync: z.boolean(),
});

export default function ProjectOwnership() {
  const theme = useTheme();
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const ownershipTitle = t('Ownership Rules');
  const {project} = useProjectSettingsOutlet();

  const ownershipQueryKey: ApiQueryKey = [
    getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/ownership/`, {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
    }),
  ];
  const {
    data: ownership,
    isPending: isOwnershipPending,
    isError: isOwnershipError,
  } = useApiQuery<IssueOwnership>(ownershipQueryKey, {staleTime: Infinity});

  const codeownersQueryKey: ApiQueryKey = [
    getApiUrl(`/projects/$organizationIdOrSlug/$projectIdOrSlug/codeowners/`, {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
    }),
    {query: {expand: ['codeMapping', 'ownershipSyntax']}},
  ];
  const {
    data: codeowners = [],
    isLoading: isCodeownersLoading,
    isError: isCodeownersError,
  } = useApiQuery<CodeOwner[]>(codeownersQueryKey, {
    staleTime: Infinity,
    enabled: organization.features.includes('integrations-codeowners'),
  });

  const handleOwnershipSave = (newOwnership: IssueOwnership) => {
    setApiQueryData<IssueOwnership>(queryClient, ownershipQueryKey, data =>
      newOwnership ? newOwnership : data
    );
    closeModal();
  };

  const handleCodeOwnerAdded = (data: CodeOwner) => {
    setApiQueryData<CodeOwner[]>(queryClient, codeownersQueryKey, existingCodeowners => [
      data,
      ...(existingCodeowners || []),
    ]);
  };

  const handleCodeOwnerDeleted = (data: CodeOwner) => {
    setApiQueryData<CodeOwner[]>(queryClient, codeownersQueryKey, existingCodeowners =>
      (existingCodeowners || []).filter(codeowner => codeowner.id !== data.id)
    );
  };

  const handleCodeOwnerUpdated = (data: CodeOwner) => {
    setApiQueryData<CodeOwner[]>(queryClient, codeownersQueryKey, stateCodeOwners => {
      const existingCodeowners = stateCodeOwners || [];
      const index = existingCodeowners.findIndex(item => item.id === data.id);
      return [
        ...existingCodeowners.slice(0, index),
        data,
        ...existingCodeowners.slice(index + 1),
      ];
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
        url: `/projects/${organization.slug}/${project.slug}/ownership/`,
        method: 'PUT',
        data,
      }),
  };

  if (isOwnershipPending || isCodeownersLoading) {
    return <LoadingIndicator />;
  }

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/ownership/">
      <SentryDocumentTitle title={routeTitleGen(ownershipTitle, project.slug, false)}>
        <SettingsPageHeader
          title={t('Ownership Rules')}
          action={
            <Grid flow="column" align="center" gap="md">
              {hasCodeowners && (
                <Access access={['org:integrations']} project={project}>
                  {({hasAccess}) => (
                    <Button
                      onClick={handleAddCodeOwner}
                      size="sm"
                      data-test-id="add-codeowner-button"
                      disabled={!hasAccess}
                    >
                      {t('Import CODEOWNERS')}
                    </Button>
                  )}
                </Access>
              )}
              <Button
                type="button"
                size="sm"
                icon={<IconEdit />}
                priority="primary"
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
          }
        />
        <TextBlock>
          {tct(
            `Auto-assign issues to users and teams. To learn more, [link:read the docs].`,
            {
              link: (
                <ExternalLink href="https://docs.sentry.io/product/error-monitoring/issue-owners/" />
              ),
            }
          )}
        </TextBlock>
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
        {ownership && (
          <ErrorBoundary mini>
            <OwnershipRulesTable
              projectRules={ownership.schema?.rules ?? []}
              codeowners={codeowners ?? []}
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
            <AutoSaveField
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
            </AutoSaveField>
            <AutoSaveField
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
            </AutoSaveField>
          </FieldGroup>
        ) : (
          <Alert.Container>
            <Alert variant="danger" showIcon={false}>
              {t('There was an error issue owner settings.')}
            </Alert>
          </Alert.Container>
        )}
      </SentryDocumentTitle>
    </FormSearch>
  );
}
