import {useMemo} from 'react';
import styled from '@emotion/styled';
import {useInfiniteQuery} from '@tanstack/react-query';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {SeerProjectRepoInput} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';
import {
  useAddProjectSeerRepos,
  useDeleteProjectSeerRepo,
  useProjectSeerRepos,
  useUpdateProjectSeerRepo,
} from 'sentry/components/events/autofix/preferences/hooks/useProjectSeerRepos';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  organizationRepositoriesInfiniteOptions,
  selectUniqueRepos,
} from 'sentry/utils/repositories/repoQueryOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AddAutofixRepoModal} from 'sentry/views/settings/projectSeer/addAutofixRepoModal';

import {AutofixRepositoriesItem} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesItem';

interface Props {
  canWrite: boolean;
  project: Project;
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

export function AutofixRepositories({canWrite, project}: Props) {
  const {openModal} = useModal();

  const organization = useOrganization();

  const {data: repos, isPending} = useProjectSeerRepos(project);
  const connectedRepos = useMemo(() => repos ?? [], [repos]);

  // Org repos are only needed to power the "Add" modal and to translate the
  // externalId selections it returns into the repositoryId (Repository PK) the
  // seer/repos endpoints expect.
  const repositoriesQuery = useInfiniteQuery({
    ...organizationRepositoriesInfiniteOptions({organization, query: {per_page: 100}}),
    select: selectUniqueRepos,
  });
  useFetchAllPages({result: repositoriesQuery});
  const {data: orgRepositories} = repositoriesQuery;

  const orgRepoIdByExternalId = useMemo(
    () => new Map((orgRepositories ?? []).map(repo => [repo.externalId, repo.id])),
    [orgRepositories]
  );

  const {mutate: addRepos} = useAddProjectSeerRepos(project);
  const {mutate: deleteRepo} = useDeleteProjectSeerRepo(project);
  const {mutate: updateRepo} = useUpdateProjectSeerRepo(project);

  const tableHeaders = getTableHeaders(organization);

  const handleAddRepoClick = () => {
    openModal(deps => (
      <AddAutofixRepoModal
        {...deps}
        selectedRepoIds={connectedRepos.map(repo => repo.externalId)}
        onSave={(selectedExternalIds: string[]) => {
          const connectedExternalIds = new Set(
            connectedRepos.map(repo => repo.externalId)
          );
          const newRepos: SeerProjectRepoInput[] = [];
          for (const externalId of selectedExternalIds) {
            if (connectedExternalIds.has(externalId)) {
              continue;
            }
            const repositoryId = orgRepoIdByExternalId.get(externalId);
            if (repositoryId === undefined) {
              continue;
            }
            newRepos.push({repositoryId: Number(repositoryId)});
          }

          if (newRepos.length === 0) {
            return;
          }

          addRepos(newRepos, {
            onError: () => addErrorMessage(t('Failed to connect repositories')),
            onSuccess: () =>
              addSuccessMessage(
                t('%s repo(s) connected to %s', newRepos.length, project.slug)
              ),
          });
        }}
      />
    ));
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (connectedRepos.length === 0) {
    return (
      <PanelTable headers={tableHeaders.slice(0, 1)}>
        <Flex padding="2xl" align="center" justify="center" gap="xl">
          <img src={seerConfigBug1} alt="" width="130px" height="130px" />
          <Stack gap="lg">
            <Heading as="h4">{t('Connect a repository')}</Heading>
            <Flex maxWidth="250px">
              {t(
                'Connect at least one repository so Seer can gather more insights from your code.'
              )}
            </Flex>
            <Button
              disabled={!canWrite}
              variant="primary"
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
          variant="primary"
          icon={<IconAdd />}
          onClick={handleAddRepoClick}
        >
          {t('Add Repositories to Project')}
        </Button>
      </Flex>
      <StyledPanelTable headers={tableHeaders}>
        {connectedRepos.map(repository => (
          <AutofixRepositoriesItem
            key={repository.repositoryId}
            canWrite={canWrite}
            repositoryCount={connectedRepos.length}
            repository={repository}
            onRemoveRepo={() => {
              deleteRepo(repository.repositoryId, {
                onError: () => addErrorMessage(t('Failed to disconnect repository')),
              });
            }}
            onUpdateRepo={update => {
              updateRepo(
                {repositoryId: repository.repositoryId, data: update},
                {
                  onError: () => addErrorMessage(t('Failed to update repository')),
                }
              );
            }}
          />
        ))}
      </StyledPanelTable>
    </Stack>
  );
}

const StyledPanelTable = styled(PanelTable)`
  margin-bottom: 0;
  grid-template-columns: 1fr repeat(2, max-content);
`;
