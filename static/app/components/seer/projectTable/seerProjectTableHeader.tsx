import {useMemo} from 'react';
import {
  useIsMutating,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import type {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgentDropdownMenu';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPointDropdownMenu';
import {getNextSort} from 'sentry/components/tables/getNextSort';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemSelectedState} from 'sentry/utils/list/listItemSelectedState';
import {ListSelectAllCheckbox} from 'sentry/utils/list/listSelectAllCheckbox';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useProjectsById} from 'sentry/utils/project/useProjectsById';
import {knownAgentIntegrationsQueryOptions} from 'sentry/utils/seer/preferredAgent';
import {
  getMutateSeerProjectsSettingsOptions,
  getSeerProjectSettingsMutationKey,
} from 'sentry/utils/seer/seerProjectSettings';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  mutableSearch: MutableSearch;
  /**
   * Called after a bulk edit saves, so the table can refresh its row controls.
   */
  onBulkEditSuccess: () => void;
  onSortClick: (key: Sort) => void;
  settings: SeerProjectSettingResponse[];
  sort: Sort;
}

const COLUMNS = [
  {title: t('Project'), key: 'project', sortKey: 'name'},
  {title: t('Repos'), key: 'repos', sortKey: 'reposCount'},
  {
    title: ({organization}: {organization: Organization}) => (
      <Flex gap="sm" align="center">
        {t('Handoff to Agent')}
        <InfoTip
          title={tct(
            'Select the coding agent to use when proposing code changes. [manageLink:Manage Coding Agent Integrations]',
            {
              manageLink: (
                <Link
                  to={{
                    pathname: `/settings/${organization.slug}/integrations/`,
                    query: {category: 'coding agent'},
                  }}
                >
                  {t('Manage Coding Agent Integrations')}
                </Link>
              ),
            }
          )}
        />
      </Flex>
    ),
    key: 'fixes',
    sortKey: 'agent',
  },
  {
    title: (
      <Flex gap="sm" align="center">
        {t('Automation Steps')}
        <InfoTip
          title={t(
            'Choose which steps Seer should run automatically on issues. Depending on how actionable the issue is, Seer may stop at an earlier step.'
          )}
        />
      </Flex>
    ),
    key: 'automation_steps',
    sortKey: 'stoppingPoint',
  },
  {
    title: (
      <Flex gap="sm" align="center">
        {t('Auto-Iterate on PRs')}
        <InfoTip
          title={t(
            'After opening a PR, Seer automatically pushes fixes when CI checks fail. You can still ask Seer to iterate on a PR yourself.'
          )}
        />
      </Flex>
    ),
    key: 'pr_iteration',
    sortKey: undefined,
  },
];

export function ProjectTableHeader({
  mutableSearch,
  onBulkEditSuccess,
  onSortClick,
  settings,
  sort,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, endpointOptionsRef, selectAll, selectedIds} =
    listItemCheckboxState;
  // oxlint-disable-next-line react/refs
  const endpointOptions = endpointOptionsRef.current;
  // oxlint-disable-next-line react/refs
  const rawQuery = endpointOptions?.query?.query;
  // oxlint-disable-next-line react/refs
  const queryString = typeof rawQuery === 'string' ? rawQuery : undefined;

  const projectIds = useMemo(
    () =>
      selectedIds === 'all' ? settings.map(setting => setting.projectId) : selectedIds,
    [settings, selectedIds]
  );

  // The bulk toggle reads as "on" when any selected project has PR iteration
  // enabled. Clicking it then turns PR iteration off for every selected project;
  // clicking again turns it back on for all of them.
  const selectedHavePrIteration = useMemo(() => {
    const selectedSettings =
      selectedIds === 'all'
        ? settings
        : settings.filter(setting => selectedIds.includes(setting.projectId));
    return selectedSettings.some(setting => setting.prIteration);
  }, [settings, selectedIds]);

  const projectsById = useProjectsById();
  const {data: knownAgents} = useQuery(
    knownAgentIntegrationsQueryOptions({organization})
  );

  // A bulk edit rebuilds every row control when it finishes. Wait for any
  // single-row save to finish first, so a row isn't rebuilt in the middle of
  // its own save.
  const isRowSaving =
    useIsMutating({
      mutationKey: getSeerProjectSettingsMutationKey(organization.slug),
    }) > 0;
  const isDisabled = !canWrite || isRowSaving;

  const {mutate} = useMutation(
    getMutateSeerProjectsSettingsOptions({
      organization,
      projectsById,
      queryClient,
      knownAgents,
    })
  );

  return (
    <InfiniteTable.Head sticky>
      <ListItemSelectedState selected="none">
        <InfiniteTable.Header>
          <InfiniteTable.HeaderCell>
            <ListSelectAllCheckbox
              data={settings}
              listItemCheckboxState={listItemCheckboxState}
            />
          </InfiniteTable.HeaderCell>
          {COLUMNS.map(({title, key, sortKey}) => (
            <InfiniteTable.HeaderCell
              key={key}
              handleSortClick={
                sortKey ? () => onSortClick(getNextSort(sortKey, sort)) : undefined
              }
              sort={sort?.field === sortKey ? sort.kind : undefined}
            >
              {typeof title === 'function' ? title({organization}) : title}
            </InfiniteTable.HeaderCell>
          ))}
        </InfiniteTable.Header>
      </ListItemSelectedState>

      <ListItemSelectedState selected="indeterminate-or-all">
        <InfiniteTable.Header>
          <InfiniteTable.HeaderCell variant="first">
            <ListSelectAllCheckbox
              data={settings}
              listItemCheckboxState={listItemCheckboxState}
            />
          </InfiniteTable.HeaderCell>
          <InfiniteTable.HeaderCellRemaining>
            <PreferredAgentDropdownMenu
              isDisabled={isDisabled}
              onChange={value => {
                mutate(
                  {
                    query: mutableSearch.formatString(),
                    selectedIds,
                    agentOption: value,
                  },
                  {
                    onError: () =>
                      addErrorMessage(
                        tn(
                          'Failed to update agent for %s project',
                          'Failed to update agent for %s projects',
                          projectIds.length
                        )
                      ),
                    onSuccess: () => {
                      onBulkEditSuccess();
                      addSuccessMessage(
                        tn(
                          'Agent updated for %s project',
                          'Agent updated for %s projects',
                          projectIds.length
                        )
                      );
                    },
                  }
                );
              }}
            />
            <StoppingPointDropdownMenu
              isDisabled={isDisabled}
              onChange={value => {
                mutate(
                  {
                    query: mutableSearch.formatString(),
                    selectedIds,
                    stoppingPoint: value,
                  },
                  {
                    onError: () =>
                      addErrorMessage(
                        tn(
                          'Failed to update stopping point for %s project',
                          'Failed to update stopping point for %s projects',
                          projectIds.length
                        )
                      ),
                    onSuccess: () => {
                      onBulkEditSuccess();
                      addSuccessMessage(
                        tn(
                          'Stopping point updated for %s project',
                          'Stopping point updated for %s projects',
                          projectIds.length
                        )
                      );
                    },
                  }
                );
              }}
            />
            <Flex as="label" align="center" gap="sm">
              <Switch
                aria-label={t('Auto-iterate on PRs for selected projects')}
                checked={selectedHavePrIteration}
                disabled={isDisabled}
                onChange={() => {
                  const prIteration = !selectedHavePrIteration;
                  mutate(
                    {
                      query: mutableSearch.formatString(),
                      selectedIds,
                      prIteration,
                    },
                    {
                      onError: () =>
                        addErrorMessage(
                          tn(
                            'Failed to update PR iteration for %s project',
                            'Failed to update PR iteration for %s projects',
                            projectIds.length
                          )
                        ),
                      onSuccess: () => {
                        onBulkEditSuccess();
                        addSuccessMessage(
                          prIteration
                            ? tn(
                                'PR iteration enabled for %s project',
                                'PR iteration enabled for %s projects',
                                projectIds.length
                              )
                            : tn(
                                'PR iteration disabled for %s project',
                                'PR iteration disabled for %s projects',
                                projectIds.length
                              )
                        );
                      },
                    }
                  );
                }}
              />
              {t('Auto-Iterate on PRs')}
            </Flex>
          </InfiniteTable.HeaderCellRemaining>
        </InfiniteTable.Header>
      </ListItemSelectedState>

      <ListItemSelectedState selected="indeterminate">
        <InfiniteTable.HeaderBanner>
          <Alert variant="info" system>
            <Flex justify="start" width="100%" wrap="wrap" gap="md">
              {tn('Selected %s project.', 'Selected %s projects.', countSelected)}
              <a onClick={selectAll}>
                {/* oxlint-disable-next-line react/refs */}
                {queryString
                  ? tct('Select all [count] projects that match: [queryString].', {
                      count: listItemCheckboxState.hits,
                      // oxlint-disable-next-line react/refs
                      queryString: <var>{queryString}</var>,
                    })
                  : t('Select all %s projects.', listItemCheckboxState.hits)}
              </a>
            </Flex>
          </Alert>
        </InfiniteTable.HeaderBanner>
      </ListItemSelectedState>

      <ListItemSelectedState selected="all">
        <InfiniteTable.HeaderBanner>
          <Alert variant="info" system>
            {/* oxlint-disable-next-line react/refs */}
            {queryString
              ? tct('Selected all [count] projects matching: [queryString].', {
                  count: countSelected,
                  // oxlint-disable-next-line react/refs
                  queryString: <var>{queryString}</var>,
                })
              : countSelected > settings.length
                ? t('Selected all %s+ projects.', settings.length)
                : tn('Selected %s project.', 'Selected all %s projects.', countSelected)}
          </Alert>
        </InfiniteTable.HeaderBanner>
      </ListItemSelectedState>
    </InfiniteTable.Head>
  );
}
