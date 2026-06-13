import styled from '@emotion/styled';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {Heading} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {QuestionTooltip} from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons/iconAdd';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {
  getDeleteSeerProjectRepoOptions,
  getMutateSeerProjectReposOptionsAddRepo,
  getSeerProjectReposInfiniteQueryOptions,
} from 'sentry/utils/seer/seerProjectRepos';
import {useOrganization} from 'sentry/utils/useOrganization';
import {AddAutofixRepoModal} from 'sentry/views/settings/projectSeer/addAutofixRepoModal';

import {AutofixRepositoriesItem} from 'getsentry/views/seerAutomation/components/projectDetails/autofixRepositoriesItem';

interface Props {
  canWrite: boolean;
  // preference: ProjectSeerPreferences;
  project: Project;

  // // TODO(ryan953): We can use code-mapping-repos to pre-populate the repo list,
  // // maybe we offer it as an import button that pulls them in.
  // codeMappingRepos?: undefined | SeerRepoDefinition[];
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

  const queryClient = useQueryClient();
  const organization = useOrganization();

  const seerProjectReposQuery = useInfiniteQuery({
    ...getSeerProjectReposInfiniteQueryOptions({organization, project}),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  useFetchAllPages({result: seerProjectReposQuery});
  const {data, isPending, isError, error} = seerProjectReposQuery;

  // Add some repos to the list for this project.
  const {mutateAsync: handleAddRepo} = useMutation(
    getMutateSeerProjectReposOptionsAddRepo({
      organization,
      project,
      queryClient,
    })
  );

  // Remove a single repo from the list for this project
  const {mutateAsync: handleRemoveRepo} = useMutation(
    getDeleteSeerProjectRepoOptions({
      organization,
      project,
      queryClient,
    })
  );

  // Save the whole form?
  // const {mutateAsync: handleFormSubmit} = useMutation(
  //   getMutateSeerProjectReposOptionsReplaceRepos({
  //     organization,
  //     project,
  //     queryClient,
  //   })
  // );

  const handleAddRepoClick = () => {
    openModal(deps => (
      <AddAutofixRepoModal
        {...deps}
        hiddenExternalIds={data?.map(repo => repo.externalId) ?? []}
        onSave={({selectedRepoIds}) => {
          handleAddRepo({
            repos: selectedRepoIds.map(repoId => ({
              repositoryId: repoId,
              branchName: null,
              branchOverrides: [],
              instructions: null,
            })),
          });
        }}
      />
    ));
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError message={error?.message} />;
  }

  const tableHeaders = getTableHeaders(organization);

  if (!data.length) {
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
        {data.map(repository => (
          <AutofixRepositoriesItem
            key={repository.repositoryId}
            canWrite={canWrite}
            onRemoveRepo={handleRemoveRepo}
            project={project}
            repositories={data}
            repository={repository}
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
