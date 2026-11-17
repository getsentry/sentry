import styled from '@emotion/styled';
import {IconAdd} from '@sentry/icons/add';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import seerConfigBug1 from 'getsentry-images/spot/seer-config-bug-1.svg';

import {Button} from '@sentry/scraps/button';
import {InfoTip} from '@sentry/scraps/info';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading} from '@sentry/scraps/text';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {AddAutofixRepoModal} from 'sentry/components/seer/legacy/addAutofixRepoModal';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {isSeerTokenBasedBillingOnboardingEnabled} from 'sentry/utils/seer/isSeerTokenBasedBillingOnboardingEnabled';
import {
  getDeleteSeerProjectRepoOptions,
  getMutateSeerProjectReposOptionsAddRepo,
  getSeerProjectReposInfiniteQueryOptions,
} from 'sentry/utils/seer/seerProjectRepos';
import {useOrganization} from 'sentry/utils/useOrganization';

import {AutofixRepositoriesItem} from './autofixRepositoriesItem';

const REPOSITORY_COLUMNS: TableColumnConfig[] = [
  {key: 'repositories', width: '1fr'},
  {key: 'integration', width: 'max-content'},
  {key: 'actions', width: 'max-content'},
];

interface Props {
  canWrite: boolean;
  includeInstructions: boolean;
  project: Project;
}

const getTableHeaders = (
  organization: Organization,
  isTokenBilled: boolean
): React.ReactNode[] => {
  const link = <Link to={`/settings/${organization.slug}/integrations/github/`} />;
  return [
    <Flex key="connected-repositories" align="center" gap="md">
      {isTokenBilled ? t('Linked Repositories') : t('Connected Repositories')}
      <InfoTip
        size="xs"
        title={
          isTokenBilled
            ? tct(
                'Seer can read code from, and open PRs in, the repos linked to this project. Seer needs the [link:GitHub integration] to access them.',
                {link}
              )
            : tct(
                'Seer will only be able to see code from, and make PRs to, the repos connected here. The [link:GitHub integration] is required for Seer to access these repos.',
                {link}
              )
        }
      />
    </Flex>,
    t('Integration'),
    ...(isTokenBilled ? [] : [null]),
  ];
};

export function AutofixRepositoriesList({canWrite, includeInstructions, project}: Props) {
  const {openModal} = useModal();

  const queryClient = useQueryClient();
  const organization = useOrganization();
  const isTokenBilled = isSeerTokenBasedBillingOnboardingEnabled(organization);

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

  const handleAddRepoClick = () => {
    openModal(deps => (
      <AddAutofixRepoModal
        {...deps}
        hiddenExternalIds={data?.map(repo => repo.externalId) ?? []}
        onSave={({selectedRepoIds}) => {
          if (selectedRepoIds.length === 0) {
            return;
          }
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

  const tableHeaders = getTableHeaders(organization, isTokenBilled);
  const addRepoLabel = isTokenBilled
    ? t('Link Repositories')
    : t('Add Repositories to Project');

  if (!data.length) {
    return (
      <SimpleTable
        header={
          <SimpleTable.HeaderRow>
            <SimpleTable.HeaderCell>{tableHeaders[0]}</SimpleTable.HeaderCell>
          </SimpleTable.HeaderRow>
        }
      >
        <SimpleTable.Empty>
          <Flex padding="2xl" align="center" justify="center" gap="xl">
            <img src={seerConfigBug1} alt="" width="130px" height="130px" />
            <Stack gap="lg">
              <Heading as="h4">
                {isTokenBilled ? t('Link a repository') : t('Connect a repository')}
              </Heading>
              <Flex maxWidth="250px">
                {isTokenBilled
                  ? t('Link a repository to this project so Seer can read your code.')
                  : t(
                      'Connect at least one repository so Seer can gather more insights from your code.'
                    )}
              </Flex>
              <Button
                disabled={!canWrite}
                variant="primary"
                icon={<IconAdd />}
                onClick={handleAddRepoClick}
              >
                {addRepoLabel}
              </Button>
            </Stack>
          </Flex>
        </SimpleTable.Empty>
      </SimpleTable>
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
          {addRepoLabel}
        </Button>
      </Flex>

      <StyledSimpleTable
        columns={isTokenBilled ? REPOSITORY_COLUMNS.slice(0, 2) : REPOSITORY_COLUMNS}
        header={
          <SimpleTable.HeaderRow>
            {tableHeaders.map((header, i) => (
              <SimpleTable.HeaderCell key={i}>{header}</SimpleTable.HeaderCell>
            ))}
          </SimpleTable.HeaderRow>
        }
      >
        {data.map(repository => (
          <AutofixRepositoriesItem
            key={repository.repositoryId}
            includeInstructions={includeInstructions}
            canWrite={canWrite}
            onRemoveRepo={handleRemoveRepo}
            project={project}
            repositories={data}
            repository={repository}
          />
        ))}
      </StyledSimpleTable>
    </Stack>
  );
}

const StyledSimpleTable = styled(SimpleTable)`
  margin-bottom: 0;
`;
