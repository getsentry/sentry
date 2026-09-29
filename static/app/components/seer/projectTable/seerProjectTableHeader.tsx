import {useMemo} from 'react';
import {useIsMutating, type UseMutationResult} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import type {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgentDropdownMenu';
import {PrIterationDropdownMenu} from 'sentry/components/seer/prIterationDropdownMenu';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPointDropdownMenu';
import {getNextSort} from 'sentry/components/tables/getNextSort';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemSelectedState} from 'sentry/utils/list/listItemSelectedState';
import {ListSelectAllCheckbox} from 'sentry/utils/list/listSelectAllCheckbox';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {
  getSeerProjectSettingsMutationKey,
  type SeerBulkEditVariables,
} from 'sentry/utils/seer/seerProjectSettings';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props {
  /**
   * The bulk save, owned by the table so it can lock and refresh the rows.
   */
  bulkEdit: UseMutationResult<unknown, Error, SeerBulkEditVariables>;
  mutableSearch: MutableSearch;
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
  bulkEdit,
  mutableSearch,
  onSortClick,
  settings,
  sort,
}: Props) {
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

  // A bulk edit rebuilds every row control when it finishes. Wait for any
  // single-row save to finish first, so a row isn't rebuilt in the middle of
  // its own save.
  const isRowSaving =
    useIsMutating({
      mutationKey: getSeerProjectSettingsMutationKey(organization.slug),
    }) > 0;

  const {mutate, isPending: isBulkSaving} = bulkEdit;

  // Only one bulk edit runs at a time, so two can't race to be the last one
  // the server saves.
  const isDisabled = !canWrite || isRowSaving || isBulkSaving;

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
            <PrIterationDropdownMenu
              isDisabled={isDisabled}
              onChange={prIteration => {
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
