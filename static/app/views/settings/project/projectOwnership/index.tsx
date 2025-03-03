import {closeModal, openEditOwnershipRules, openModal} from 'sentry/actionCreators/modal';
import Access, {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconEdit} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {IssueOwnership} from 'sentry/types/group';
import type {CodeOwner} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';
import {
  type ApiQueryKey,
  setApiQueryData,
  useApiQuery,
  useQueryClient,
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

export default function ProjectOwnership({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const ownershipTitle = t('Ownership Rules');

  const ownershipQueryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${project.slug}/ownership/`,
  ];
  const {
    data: ownership,
    isPending: isOwnershipPending,
    isError: isOwnershipError,
  } = useApiQuery<IssueOwnership>(ownershipQueryKey, {staleTime: Infinity});

  const codeownersQueryKey: ApiQueryKey = [
    `/projects/${organization.slug}/${project.slug}/codeowners/`,
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

  if (isOwnershipPending || isCodeownersLoading) {
    return <LoadingIndicator />;
  }

  return (
    <SentryDocumentTitle title={routeTitleGen(ownershipTitle, project.slug, false)}>
      <SettingsPageHeader
        title={t('Ownership Rules')}
        action={
          <ButtonBar gap={1}>
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
                })
              }
              disabled={!!ownership && editOwnershipRulesDisabled}
            >
              {t('Edit Rules')}
            </Button>
          </ButtonBar>
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
        access={!editOwnershipRulesDisabled ? ['project:read'] : ['project:write']}
        project={project}
      />
      {isCodeownersError && (
        <Alert.Container>
          <Alert type="error">
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
        <Form
          apiEndpoint={`/projects/${organization.slug}/${project.slug}/ownership/`}
          apiMethod="PUT"
          saveOnBlur
          initialData={{
            fallthrough: ownership.fallthrough,
            autoAssignment: ownership.autoAssignment,
            codeownersAutoSync: ownership.codeownersAutoSync,
          }}
          hideFooter
        >
          <JsonForm
            forms={[
              {
                title: t('Issue Owners'),
                fields: [
                  {
                    name: 'autoAssignment',
                    type: 'choice',
                    label: t('Prioritize Auto Assignment'),
                    help: t(
                      "When there's a conflict between suspect commit and ownership rules."
                    ),
                    choices: [
                      [
                        'Auto Assign to Suspect Commits',
                        t('Auto-assign to suspect commits'),
                      ],
                      ['Auto Assign to Issue Owner', t('Auto-assign to issue owner')],
                      ['Turn off Auto-Assignment', t('Turn off auto-assignment')],
                    ],
                    disabled,
                  },
                  {
                    name: 'codeownersAutoSync',
                    type: 'boolean',
                    label: t('Sync changes from CODEOWNERS'),
                    help: t(
                      'We’ll update any changes you make to your CODEOWNERS files during a release.'
                    ),
                    disabled: disabled || !(codeowners || []).length,
                  },
                ],
              },
            ]}
          />
        </Form>
      ) : (
        <Alert.Container>
          <Alert type="error">{t('There was an error issue owner settings.')}</Alert>
        </Alert.Container>
      )}
    </SentryDocumentTitle>
  );
}
