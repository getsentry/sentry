import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import {
  infiniteQueryOptions,
  type UseInfiniteQueryResult,
  useInfiniteQuery,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {debounce, parseAsStringLiteral, parseAsString, useQueryState} from 'nuqs';

import SeerConfigConnect2 from 'sentry-images/spot/seer-config-connect-2.svg';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {AutoSaveForm} from '@sentry/scraps/form';
import {Image} from '@sentry/scraps/image';
import {InfoText} from '@sentry/scraps/info';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {useModal} from '@sentry/scraps/modal';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Select} from '@sentry/scraps/select';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {CodingAgentProvider} from 'sentry/components/events/autofix/types';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {ProjectTableHeader} from 'sentry/components/seer/projectTable/seerProjectTableHeader';
import {IconAdd} from 'sentry/icons/iconAdd';
import {IconSearch} from 'sentry/icons/iconSearch';
import {t, tct} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {useFetchAllPages} from 'sentry/utils/api/apiFetch';
import {safeParseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {ListItemCheckboxProvider} from 'sentry/utils/list/useListItemCheckboxState';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {
  seerAgentIntegrationsSelectQueryOptions,
  knownAgentIntegrationsQueryOptions,
  coalesePreferredAgent,
  NON_GITHUB_HANDOFF_WARNING,
  orgDefaultAgentQueryOptions,
  seerAgentProviderNameSelectQueryOptions,
} from 'sentry/utils/seer/preferredAgent';
import {
  fetchProjectHasNonGithubRepo,
  isGitHubProvider,
  prefetchAllSeerProjectRepos,
} from 'sentry/utils/seer/seerProjectRepos';
import {
  getMutateSeerProjectSettingsOptions,
  getInfiniteSeerProjectsSettingsQueryOptions,
  seerProjectSettingsSchema,
} from 'sentry/utils/seer/seerProjectSettings';
import {getInfiniteSeerProjectSuggestionsQueryOptions} from 'sentry/utils/seer/seerProjectSuggestions';
import {
  coaleseStoppingPoint,
  PROJECT_STOPPING_POINT_OPTIONS,
  useOrgDefaultStoppingPoint,
  useStoppingPointSelectOptions,
} from 'sentry/utils/seer/stoppingPoint';
import type {
  AgentIntegration,
  AutofixAgentSelectOption,
  SeerProjectSuggestionResponse,
  UserFacingStoppingPoint,
} from 'sentry/utils/seer/types';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {
  AutofixSettingsPartialSaveError,
  type AutofixProjectMutationVariables,
  useMutateAutofixProject,
} from 'sentry/utils/seer/useMutateAutofixProject';
import {parseAsSort} from 'sentry/utils/url/parseAsSort';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

const estimateSize = () => 41;

// Header and body rows are separate grids that each apply this template, so
// suggestion rows must use the identical string to stay column-aligned. The
// trailing track is a fixed width (not max-content) for the same reason: it
// holds the suggestion-row action button and stays empty in the other rows,
// and a per-row max-content track would resolve to different widths.
const TABLE_COLUMNS = 'max-content 2fr 74px repeat(2, 1fr) 132px';

export function SeerProjectTable() {
  const queryClient = useQueryClient();
  const location = useLocation();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const [failedSuggestionMutationVariables, setFailedSuggestionMutationVariables] =
    useState<AutofixProjectMutationVariables | null>(null);

  // Query Values
  const [agentFilter, setAgentFilter] = useQueryState(
    'agent',
    parseAsStringLiteral([
      'all',
      'seer',
      ...Object.values(CodingAgentProvider), // we will accept copilot here, but it's filtered from the dropdown options
    ]).withDefault('all')
  );
  const [searchTerm, setSearchTerm] = useQueryState(
    'name',
    parseAsString.withDefault('')
  );
  const [sortBy, setSort] = useQueryState(
    'sortBy',
    parseAsSort.withDefault({field: 'name', kind: 'asc'})
  );

  // Supporting fetch calls
  const projectsById = useProjectsById();
  const {data: knownAgentProviders = []} = useQuery(
    seerAgentProviderNameSelectQueryOptions({organization})
  );
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );
  const {data: agentSelectOptions = []} = useQuery(
    seerAgentIntegrationsSelectQueryOptions({organization})
  );
  const stoppingPointOptions = useStoppingPointSelectOptions();

  // Main fetch call
  const mutableSearch = MutableSearch.fromQueryObject({
    reposCount: '>0',
    agent: agentFilter === 'all' ? undefined : agentFilter,
    name: searchTerm,
  });
  const queryOptions = infiniteQueryOptions({
    ...getInfiniteSeerProjectsSettingsQueryOptions({
      organization,
      query: {
        per_page: 25,
        query: mutableSearch,
        sortBy,
      },
    }),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  const result = useInfiniteQuery(queryOptions);
  useFetchAllPages({result});
  const {data, isPending, isError, error, hasNextPage} = result;

  const suggestionsEnabled =
    organization.features.includes('seer-autofix-quick-add') &&
    canWrite &&
    searchTerm === '' &&
    agentFilter === 'all';
  const suggestionsResult = useInfiniteQuery({
    ...getInfiniteSeerProjectSuggestionsQueryOptions({
      organization,
      enabled: suggestionsEnabled,
    }),
    select: ({pages}) => pages.flatMap(page => page.json),
  });
  const suggestions = suggestionsEnabled ? (suggestionsResult.data ?? []) : [];
  const suggestionsSettled = !suggestionsEnabled || !suggestionsResult.isPending;
  const suggestionsFailed = suggestionsEnabled && suggestionsResult.isError;

  if (
    !failedSuggestionMutationVariables &&
    !isError &&
    !isPending &&
    data?.length === 0 &&
    !hasNextPage &&
    searchTerm === '' &&
    agentFilter === 'all' &&
    suggestionsSettled &&
    !suggestionsFailed &&
    suggestions.length === 0
  ) {
    return (
      <Container display="flex" padding="2xl" border="primary" radius="md">
        <Flex flexGrow={1} justify="center">
          <Flex align="center" justify="center" gap="2xl">
            <Flex>
              <Image src={SeerConfigConnect2} alt="" height="132px" />
            </Flex>
            <Stack gap="xl" maxWidth="330px">
              <Heading as="h3" size="lg">
                {t('Enable Autofix on a Project')}
              </Heading>
              <Text variant="muted" size="md">
                {t(
                  'Add projects here in order to enable Autofix. Each project must be associated with a repository in order for Autofix to work.'
                )}
              </Text>
              <Flex>
                <AddProjectButton />
              </Flex>
            </Stack>
          </Flex>
        </Flex>
      </Container>
    );
  }

  return (
    <Fragment>
      <Stack>
        <Flex gap="md" wrap="wrap">
          {agentSelectOptions.length ? (
            <CompactSelect
              trigger={triggerProps => (
                <OverlayTrigger.Button {...triggerProps} size="md" prefix={t('Agent')}>
                  {triggerProps.children}
                </OverlayTrigger.Button>
              )}
              options={[{value: 'all', label: t('All')}, ...knownAgentProviders]}
              onChange={option => setAgentFilter(option.value)}
              value={agentFilter ?? 'all'}
            />
          ) : null}
          <InputGroup style={{flex: 1}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="md"
              placeholder={t('Search')}
              value={searchTerm}
              onChange={e =>
                setSearchTerm(e.target.value, {limitUrlUpdates: debounce(125)})
              }
            />
          </InputGroup>
          <AddProjectButton />
        </Flex>
      </Stack>
      <ListItemCheckboxProvider
        hits={data?.length ?? 0}
        knownIds={data?.map(item => String(item.projectId)) ?? []}
        endpointOptions={safeParseQueryKey(queryOptions.queryKey)?.options}
      >
        <InfiniteTable.Table columns={TABLE_COLUMNS}>
          <ProjectTableHeader
            settings={data ?? []}
            sort={sortBy}
            onSortClick={setSort}
            mutableSearch={mutableSearch}
          />

          {suggestionsEnabled || failedSuggestionMutationVariables ? (
            <SuggestedProjectRows
              agentSelectOptions={agentSelectOptions}
              failedMutationVariables={failedSuggestionMutationVariables}
              result={suggestionsResult}
              suggestionsEnabled={suggestionsEnabled}
              onFailedMutationVariablesChange={setFailedSuggestionMutationVariables}
            />
          ) : null}

          <InfiniteTable.Scrollable>
            {isPending ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingIndicator />
              </Flex>
            ) : isError ? (
              <Flex justify="center" align="center" padding="xl" style={{minHeight: 200}}>
                <LoadingError message={error?.message} />
              </Flex>
            ) : data.length === 0 ? (
              <InfiniteTable.Empty>
                {searchTerm
                  ? agentFilter === 'all'
                    ? tct('No projects found matching [searchTerm]', {
                        searchTerm: <code>{searchTerm}</code>,
                      })
                    : tct('No projects found matching [searchTerm] with [agentFilter]', {
                        searchTerm: <code>{searchTerm}</code>,
                        agentFilter: <code>{agentFilter}</code>,
                      })
                  : agentFilter === 'all'
                    ? t('No projects found')
                    : tct('No projects found with [agentFilter]', {
                        agentFilter: <code>{agentFilter}</code>,
                      })}
              </InfiniteTable.Empty>
            ) : (
              <Fragment>
                <InfiniteTable.Body
                  estimateSize={estimateSize}
                  queryResult={result}
                  select={_ => _ ?? []}
                >
                  {item => (
                    <InfiniteTable.Row>
                      <InfiniteTable.RowCell>
                        <ListItemSelectCheckbox
                          htmlPrefix="seer-project-settings"
                          value={String(item.projectId)}
                        />
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Link
                          to={{
                            pathname: `/settings/${organization.slug}/seer/projects/${item.projectSlug}/`,
                            query: location.query,
                          }}
                        >
                          <ProjectBadge
                            disableLink
                            project={
                              projectsById.get(item.projectId) ?? {slug: item.projectSlug}
                            }
                            avatarSize={16}
                          />
                        </Link>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell justify="end">
                        <Text tabular>{item.reposCount}</Text>
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell overflow="visible">
                        <AgentSelectCell
                          projectSlug={item.projectSlug}
                          initialValue={coalesePreferredAgent(
                            item.agent,
                            item.integrationId
                          )}
                          agentSelectOptions={agentSelectOptions}
                          knownAgents={knownAgents}
                          disabled={!canWrite}
                        />
                      </InfiniteTable.RowCell>
                      <InfiniteTable.RowCell>
                        <Stack align="stretch" flex="1">
                          <AutoSaveForm
                            name="stoppingPoint"
                            schema={seerProjectSettingsSchema}
                            initialValue={coaleseStoppingPoint(
                              item.stoppingPoint,
                              item.automationTuning
                            )}
                            mutationOptions={getMutateSeerProjectSettingsOptions({
                              organization,
                              project: {slug: item.projectSlug},
                              queryClient,
                            })}
                          >
                            {field => (
                              <field.Select
                                disabled={!canWrite}
                                menuPortalTarget={document.body}
                                onChange={field.handleChange}
                                options={stoppingPointOptions}
                                // @ts-expect-error: Select component does not have a size prop defined
                                size="xs"
                                value={field.state.value}
                              />
                            )}
                          </AutoSaveForm>
                        </Stack>
                      </InfiniteTable.RowCell>
                    </InfiniteTable.Row>
                  )}
                </InfiniteTable.Body>
                <InfiniteTable.LoadingRow queryResult={result} />
              </Fragment>
            )}
          </InfiniteTable.Scrollable>
        </InfiniteTable.Table>
      </ListItemCheckboxProvider>
    </Fragment>
  );
}

interface SuggestedProjectRowsProps {
  agentSelectOptions: Array<{label: string; value: AutofixAgentSelectOption}>;
  failedMutationVariables: AutofixProjectMutationVariables | null;
  onFailedMutationVariablesChange: (
    variables: AutofixProjectMutationVariables | null
  ) => void;
  result: UseInfiniteQueryResult<SeerProjectSuggestionResponse[]>;
  suggestionsEnabled: boolean;
}

function SuggestedProjectRows({
  agentSelectOptions,
  failedMutationVariables,
  onFailedMutationVariablesChange,
  result,
  suggestionsEnabled,
}: SuggestedProjectRowsProps) {
  const organization = useOrganization();
  const projectsById = useProjectsById();
  const defaultAgentQuery = useQuery(orgDefaultAgentQueryOptions({organization}));
  const defaultAgent = defaultAgentQuery.data ?? 'seer';
  const stoppingPoint: UserFacingStoppingPoint | undefined = useOrgDefaultStoppingPoint();
  const saveMutation = useMutateAutofixProject();
  const {isLoadingModal, openProjectModal} = useProjectAddRepoModal();

  const suggestions = suggestionsEnabled ? (result.data ?? []) : [];

  async function enableAutofix(
    suggestion: SeerProjectSuggestionResponse,
    project: Project,
    agentOption: AutofixAgentSelectOption,
    selectedStoppingPoint: UserFacingStoppingPoint
  ) {
    const variables: AutofixProjectMutationVariables = {
      project,
      repoEntries: suggestion.linkedRepositories.map(repository => ({
        repoId: repository.repositoryId,
        branch: '',
      })),
      agentOption,
      stoppingPoint: selectedStoppingPoint,
    };

    try {
      await saveMutation.mutateAsync(variables);
    } catch (error) {
      if (error instanceof AutofixSettingsPartialSaveError) {
        onFailedMutationVariablesChange(variables);
        return;
      }
      addErrorMessage(t('Could not enable Autofix. Try again.'));
    }
  }

  async function retrySettings() {
    if (!failedMutationVariables) {
      return;
    }

    try {
      await saveMutation.mutateAsync(failedMutationVariables);
      onFailedMutationVariablesChange(null);
    } catch (error) {
      if (!(error instanceof AutofixSettingsPartialSaveError)) {
        addErrorMessage(t('Could not retry Autofix settings. Try again.'));
      }
    }
  }

  const showGroup =
    suggestionsEnabled && (result.isPending || result.isError || suggestions.length > 0);
  if (!showGroup && !failedMutationVariables) {
    return null;
  }

  return (
    <Fragment>
      {failedMutationVariables ? (
        <Alert
          variant="warning"
          system
          trailingItems={
            <Flex gap="sm">
              <Alert.Button
                variant="secondary"
                busy={saveMutation.isPending}
                disabled={saveMutation.isPending}
                onClick={() => void retrySettings()}
              >
                {t('Retry settings')}
              </Alert.Button>
              <Alert.Button
                variant="secondary"
                disabled={saveMutation.isPending}
                onClick={() => onFailedMutationVariablesChange(null)}
              >
                {t('Dismiss')}
              </Alert.Button>
            </Flex>
          }
        >
          {t(
            'Repositories were saved, but Autofix settings were not. Retry settings to finish setup.'
          )}
        </Alert>
      ) : null}

      {showGroup ? (
        <Fragment>
          {result.isError ? (
            <Flex
              align="center"
              justify="center"
              gap="md"
              padding="md xl"
              background="secondary"
              borderBottom="muted"
            >
              <Text size="sm" variant="muted">
                {t('Could not load suggestions.')}
              </Text>
              <Button size="xs" onClick={() => void result.refetch()}>
                {t('Retry')}
              </Button>
            </Flex>
          ) : result.isPending ? (
            <Flex
              align="center"
              justify="center"
              padding="md xl"
              background="secondary"
              borderBottom="muted"
            >
              <LoadingIndicator mini />
            </Flex>
          ) : (
            suggestions.map(suggestion => {
              const project = projectsById.get(suggestion.projectId);
              return (
                <SuggestedProjectRow
                  key={suggestion.projectId}
                  suggestion={suggestion}
                  project={project}
                  agentSelectOptions={agentSelectOptions}
                  defaultAgent={defaultAgent}
                  defaultAgentPending={defaultAgentQuery.isPending}
                  defaultStoppingPoint={stoppingPoint}
                  disabled={saveMutation.isPending || isLoadingModal}
                  isCurrentMutation={
                    saveMutation.isPending &&
                    saveMutation.variables?.project.id === project?.id
                  }
                  isLoadingModal={isLoadingModal}
                  onConfigure={configureProject =>
                    void openProjectModal(configureProject)
                  }
                  onEnable={(agentOption, selectedStoppingPoint) =>
                    project
                      ? void enableAutofix(
                          suggestion,
                          project,
                          agentOption,
                          selectedStoppingPoint
                        )
                      : undefined
                  }
                />
              );
            })
          )}

          {result.hasNextPage ? (
            <Flex justify="center" background="secondary" borderBottom="muted">
              <Button
                size="xs"
                variant="transparent"
                busy={result.isFetchingNextPage}
                disabled={result.isFetchingNextPage}
                onClick={() => void result.fetchNextPage()}
              >
                {t('Show more')}
              </Button>
            </Flex>
          ) : null}
        </Fragment>
      ) : null}
    </Fragment>
  );
}

interface SuggestedProjectRowProps {
  agentSelectOptions: Array<{label: string; value: AutofixAgentSelectOption}>;
  defaultAgent: AutofixAgentSelectOption;
  defaultAgentPending: boolean;
  defaultStoppingPoint: UserFacingStoppingPoint | undefined;
  disabled: boolean;
  isCurrentMutation: boolean;
  isLoadingModal: boolean;
  onConfigure: (project: Project) => void;
  onEnable: (
    agentOption: AutofixAgentSelectOption,
    stoppingPoint: UserFacingStoppingPoint
  ) => void;
  project: Project | undefined;
  suggestion: SeerProjectSuggestionResponse;
}

function SuggestedProjectRow({
  agentSelectOptions,
  defaultAgent,
  defaultAgentPending,
  defaultStoppingPoint,
  disabled,
  isCurrentMutation,
  isLoadingModal,
  onConfigure,
  onEnable,
  project,
  suggestion,
}: SuggestedProjectRowProps) {
  // The selects hold row-local choices that are only persisted by the Enable
  // Autofix click, unlike the autosaving selects in the configured rows.
  const [agentOverride, setAgentOverride] = useState<AutofixAgentSelectOption | null>(
    null
  );
  const [stoppingPointOverride, setStoppingPointOverride] =
    useState<UserFacingStoppingPoint | null>(null);

  const hasOnlyGithubRepositories =
    suggestion.linkedRepositories.length > 0 &&
    suggestion.linkedRepositories.every(repository =>
      isGitHubProvider(repository.provider)
    );
  const selectedAgent = hasOnlyGithubRepositories
    ? (agentOverride ?? defaultAgent)
    : 'seer';
  const selectedStoppingPoint = stoppingPointOverride ?? defaultStoppingPoint;
  const shouldConfigure = suggestion.linkedReposCount > 10;

  return (
    <Grid
      columns={TABLE_COLUMNS}
      align="center"
      role="row"
      background="secondary"
      borderBottom="muted"
    >
      <InfiniteTable.RowCell>
        {/* Sized to the sm checkbox box so this row's max-content first
            column matches the checkbox rows. */}
        <Container width="16px" />
      </InfiniteTable.RowCell>
      <InfiniteTable.RowCell gap="sm">
        <ProjectBadge
          disableLink
          project={project ?? {slug: suggestion.projectSlug}}
          avatarSize={16}
        />
        <Tooltip
          title={t(
            'This project has trusted repository links and is not yet configured for Autofix.'
          )}
        >
          <Tag variant="info">{t('Suggested')}</Tag>
        </Tooltip>
      </InfiniteTable.RowCell>
      <InfiniteTable.RowCell justify="end">
        <InfoText
          tabular
          title={
            suggestion.linkedRepositories.length > 0
              ? suggestion.linkedRepositories
                  .map(repository => repository.name)
                  .join(', ')
              : t('Repository details unavailable')
          }
        >
          {suggestion.linkedReposCount}
        </InfoText>
      </InfiniteTable.RowCell>
      <InfiniteTable.RowCell overflow="visible">
        <Stack align="stretch" flex="1">
          <Select
            size="xs"
            menuPortalTarget={document.body}
            searchable={false}
            clearable={false}
            disabled={
              disabled ||
              shouldConfigure ||
              defaultAgentPending ||
              !hasOnlyGithubRepositories
            }
            options={agentSelectOptions}
            value={selectedAgent}
            onChange={(option: {value: AutofixAgentSelectOption}) =>
              setAgentOverride(option.value)
            }
          />
        </Stack>
      </InfiniteTable.RowCell>
      <InfiniteTable.RowCell overflow="visible">
        <Stack align="stretch" flex="1">
          <Select
            size="xs"
            menuPortalTarget={document.body}
            searchable={false}
            clearable={false}
            disabled={disabled || shouldConfigure}
            options={PROJECT_STOPPING_POINT_OPTIONS}
            value={selectedStoppingPoint ?? null}
            onChange={(option: {value: UserFacingStoppingPoint}) =>
              setStoppingPointOverride(option.value)
            }
          />
        </Stack>
      </InfiniteTable.RowCell>
      <InfiniteTable.RowCell justify="end">
        {project ? (
          shouldConfigure ? (
            <Button
              size="xs"
              busy={isLoadingModal}
              disabled={disabled}
              onClick={() => onConfigure(project)}
            >
              {t('Configure')}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="xs"
              busy={isCurrentMutation}
              disabled={disabled || defaultAgentPending || !selectedStoppingPoint}
              onClick={() =>
                selectedStoppingPoint
                  ? onEnable(selectedAgent, selectedStoppingPoint)
                  : undefined
              }
            >
              {t('Enable Autofix')}
            </Button>
          )
        ) : (
          <Button size="xs" disabled>
            {t('Unavailable')}
          </Button>
        )}
      </InfiniteTable.RowCell>
    </Grid>
  );
}

interface AgentSelectCellProps {
  agentSelectOptions: Array<{label: string; value: AutofixAgentSelectOption}>;
  disabled: boolean;
  initialValue: AutofixAgentSelectOption;
  knownAgents: AgentIntegration[] | undefined;
  projectSlug: string;
}

function AgentSelectCell({
  agentSelectOptions,
  disabled,
  initialValue,
  knownAgents,
  projectSlug,
}: AgentSelectCellProps) {
  const organization = useOrganization();
  const queryClient = useQueryClient();

  return (
    <AutoSaveForm
      name="agentOption"
      schema={seerProjectSettingsSchema}
      initialValue={initialValue}
      mutationOptions={getMutateSeerProjectSettingsOptions({
        organization,
        project: {slug: projectSlug},
        queryClient,
        knownAgents,
      })}
    >
      {field => (
        <field.Select
          disabled={disabled}
          menuPortalTarget={document.body}
          multiple={false}
          onMenuOpen={() => {
            // Warm the cache so the on-change check below usually resolves from
            // cache instead of blocking on a fetch.
            void prefetchAllSeerProjectRepos({
              organization,
              project: {slug: projectSlug},
              queryClient,
            });
          }}
          onChange={async newValue => {
            // Coding-agent handoff only works for GitHub repos. Verify before
            // committing so a project with any non-GitHub repo stays on Seer
            // (and nothing is persisted).
            if (newValue !== 'seer') {
              let hasNonGithubRepo: boolean;
              try {
                hasNonGithubRepo = await fetchProjectHasNonGithubRepo({
                  organization,
                  project: {slug: projectSlug},
                  queryClient,
                });
              } catch {
                addErrorMessage(t('Could not verify repositories. Please try again.'));
                return;
              }
              if (hasNonGithubRepo) {
                addErrorMessage(NON_GITHUB_HANDOFF_WARNING);
                return;
              }
            }
            field.handleChange(newValue);
            field.handleBlur();
          }}
          options={agentSelectOptions}
          // @ts-expect-error: Select component does not have a size prop defined
          size="xs"
          value={field.state.value}
        />
      )}
    </AutoSaveForm>
  );
}

function useProjectAddRepoModal() {
  const {openModal} = useModal();
  const [isLoadingModal, setIsLoadingModal] = useState(false);

  async function openProjectModal(defaultProject?: Project) {
    setIsLoadingModal(true);
    try {
      const {ProjectAddRepoModal} =
        await import('sentry/components/seer/projectAddRepoModal/projectAddRepoModal');

      openModal(
        deps => (
          <ProjectAddRepoModal
            {...deps}
            title={t('Add Project to Autofix')}
            defaultProject={defaultProject}
          />
        ),
        {
          modalCss: css`
            width: 700px;
          `,
        }
      );
    } finally {
      setIsLoadingModal(false);
    }
  }

  return {isLoadingModal, openProjectModal};
}

function AddProjectButton() {
  const {isLoadingModal, openProjectModal} = useProjectAddRepoModal();

  return (
    <Button
      variant="primary"
      size="md"
      onClick={() => void openProjectModal()}
      icon={<IconAdd />}
      busy={isLoadingModal}
      disabled={isLoadingModal}
    >
      {t('Add Project')}
    </Button>
  );
}
