import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';

import {Button} from '@sentry/scraps/button/button';
import {Flex} from '@sentry/scraps/layout/flex';
import {Stack} from '@sentry/scraps/layout/stack';
import {Link} from '@sentry/scraps/link/link';
import {Heading} from '@sentry/scraps/text/heading';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {openModal} from 'sentry/actionCreators/modal';
import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import {useUpdateProjectSeerPreferences} from 'sentry/components/events/autofix/preferences/hooks/useUpdateProjectSeerPreferences';
import type {
  ProjectSeerPreferences,
  SeerRepoDefinition,
} from 'sentry/components/events/autofix/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useOrganization from 'sentry/utils/useOrganization';
import {AddAutofixRepoModal} from 'sentry/views/settings/projectSeer/addAutofixRepoModal';

import {AutofixRepositoriesItem} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesItem';

interface Props {
  canWrite: boolean;
  preference: ProjectSeerPreferences;
  project: Project;

  // TODO(ryan953): We can use code-mapping-repos to pre-populate the repo list,
  // maybe we offer it as an import button that pulls them in.
  codeMappingRepos?: undefined | SeerRepoDefinition[];
}

const getTableHeaders = (organization: Organization): React.ReactNode[] => [
  <Flex key="connected-repositories" align="center" gap="md">
    {t('Connected Repositories')}
    <QuestionTooltip
      isHoverable
      size="xs"
      title={tct(
        'Seer will only be able to see code from, and make PRs to, the repos connected here. The [link:GitHub integration] is required for Seer to access these repos.',
        {
          link: <Link to={`/settings/${organization.slug}/integrations/github/`} />,
        }
      )}
    />
  </Flex>,
  t('Integration'),
  null,
];

export default function AutofixRepositories({canWrite, preference, project}: Props) {
  const organization = useOrganization();

  const {data: repositories, isFetching: isFetchingRepositories} =
    useOrganizationRepositories();

  const {mutate: updateProjectSeerPreferences} = useUpdateProjectSeerPreferences(project);

  const tableHeaders = getTableHeaders(organization);

  const repoMap = useMemo(
    () => new Map(preference?.repositories.map(repo => [repo.external_id, repo]) ?? []),
    [preference]
  );

  const handleSaveRepoList = useCallback(
    (repoIds: string[]) => {
      const updatedRepositories: SeerRepoDefinition[] = repoIds.map(repoId => {
        // Keep existing repo settings if already configured
        const existing = repoMap.get(repoId);
        if (existing) {
          return existing;
        }

        // Create new entry with defaults for newly added repos
        const orgRepo = repositories?.find(r => r.externalId === repoId);
        const [owner] = (orgRepo?.name ?? '').split('/');
        return {
          organization_id: organization.id,
          external_id: repoId,
          name: orgRepo?.name ?? '',
          owner: owner ?? '',
          provider: orgRepo?.provider.id ?? '',
          integration_id: orgRepo?.integrationId,
          branch_name: '',
          instructions: '',
          branch_overrides: [],
        };
      });

      updateProjectSeerPreferences(
        {
          repositories: updatedRepositories,
          automated_run_stopping_point: preference?.automated_run_stopping_point,
        },
        {
          onError: () => addErrorMessage(t('Failed to connect repositories')),
          onSuccess: () =>
            addSuccessMessage(
              t('%s repo(s) connected to %s', repoIds.length, project.slug)
            ),
        }
      );
    },
    [
      updateProjectSeerPreferences,
      preference?.automated_run_stopping_point,
      repoMap,
      repositories,
      organization.id,
      project.slug,
    ]
  );

  const handleAddRepoClick = useCallback(() => {
    openModal(deps => (
      <AddAutofixRepoModal
        {...deps}
        selectedRepoIds={repoMap.keys().toArray()}
        onSave={handleSaveRepoList}
      />
    ));
  }, [repoMap, handleSaveRepoList]);

  if (isFetchingRepositories) {
    return <LoadingIndicator />;
  }

  if (!repoMap.size) {
    return (
      <PanelTable headers={tableHeaders.slice(0, 1)}>
        <Flex padding="2xl" align="center" justify="center" gap="xl">
          <img src={seerConfigBug1} alt="" width="130px" height="130px" />
          <Stack gap="lg">
            <Heading as="h4">{t('Get the most out of Seer')}</Heading>
            <Flex maxWidth="250px">
              {t(
                'Connect at least one repository so Seer can gather more insights from your code.'
              )}
            </Flex>
            <Button
              disabled={!canWrite}
              priority="primary"
              icon={<IconAdd />}
              onClick={handleAddRepoClick}
            >
              {t('Add Repositories to Project')}
            </Button>
          </Stack>
        </Flex>
      </PanelTable>
    );
  }
  return (
    <Stack gap="lg">
      <Flex justify="end">
        <Button
          disabled={!canWrite}
          priority="primary"
          icon={<IconAdd />}
          onClick={handleAddRepoClick}
        >
          {t('Add Repositories to Project')}
        </Button>
      </Flex>
      <StyledPanelTable headers={tableHeaders}>
        {repoMap
          .values()
          .toArray()
          .map(repository => (
            <AutofixRepositoriesItem
              key={repository.external_id}
              canWrite={canWrite}
              repositories={repoMap.values().toArray()}
              repository={repository}
              onRemoveRepo={() => {
                handleSaveRepoList(
                  repoMap
                    .keys()
                    .toArray()
                    .filter(key => key !== repository.external_id)
                );
              }}
              onUpdateRepo={(updatedRepo: SeerRepoDefinition) => {
                repoMap.set(updatedRepo.external_id, updatedRepo);
                handleSaveRepoList(repoMap.keys().toArray());
              }}
            />
          ))}
      </StyledPanelTable>
    </Stack>
  );
}

const StyledPanelTable = styled(PanelTable)`
  grid-template-columns: 1fr repeat(2, max-content);
`;
