import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQueryClient, type UseQueryResult} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {DropdownMenuFooter} from 'sentry/components/dropdownMenu/footer';
import type {useUpdateBulkAutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {InfiniteTable} from 'sentry/components/infiniteTable/infiniteTable';
import {PreferredAgentDropdownMenu} from 'sentry/components/seer/preferredAgent';
import {StoppingPointDropdownMenu} from 'sentry/components/seer/stoppingPoint';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {Sort} from 'sentry/utils/discover/fields';
import {ListItemSelectedState} from 'sentry/utils/list/listItemSelectedState';
import {
  useListItemCheckboxContext,
  type ListItemCheckboxState,
} from 'sentry/utils/list/useListItemCheckboxState';
import {
  useKnownAgents,
  type PreferredAgentIntegration,
} from 'sentry/utils/seer/preferredAgent';
import {getMutateSeerProjectsSettingsOptions} from 'sentry/utils/seer/seerProjectSettings';
import {PROJECT_STOPPING_POINT_OPTIONS} from 'sentry/utils/seer/stoppingPoint';
import type {SeerProjectSettingResponse} from 'sentry/utils/seer/types';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useBulkMutateSelectedAgent} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  onSortClick: (key: Sort) => void;
  projects: SeerProjectSettingResponse[];
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
];

export function ProjectTableHeader({
  projects,
  onSortClick,
  sort,
  // updateBulkAutofixAutomationSettings,
  // agentOptions,
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();

  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, endpointOptionsRef, selectAll, selectedIds} =
    listItemCheckboxState;
  const endpointOptions = endpointOptionsRef.current;
  const rawQuery = endpointOptions?.query?.query;
  const queryString = typeof rawQuery === 'string' ? rawQuery : undefined;

  const projectIds = useMemo(
    () =>
      selectedIds === 'all' ? projects.map(project => project.projectId) : selectedIds,
    [projects, selectedIds]
  );

  // const bulkMutateSelectedAgent = useBulkMutateSelectedAgent();

  const knownAgents = useKnownAgents();

  const {mutate} = useMutation(
    getMutateSeerProjectsSettingsOptions({
      organization,
      queryClient,
      knownAgents,
    })
  );

  return (
    <Fragment>
      <TableHeader>
        <InfiniteTable.HeaderCell>
          <SelectAllCheckbox
            listItemCheckboxState={listItemCheckboxState}
            projects={projects}
          />
        </InfiniteTable.HeaderCell>
        {COLUMNS.map(({title, key, sortKey}) => (
          <InfiniteTable.HeaderCell
            key={key}
            handleSortClick={
              sortKey
                ? () =>
                    onSortClick({
                      field: sortKey,
                      kind:
                        sortKey === sort.field
                          ? sort.kind === 'asc'
                            ? 'desc'
                            : 'asc'
                          : 'desc',
                    })
                : undefined
            }
            sort={sort?.field === sortKey ? sort.kind : undefined}
          >
            {typeof title === 'function' ? title({organization}) : title}
          </InfiniteTable.HeaderCell>
        ))}
      </TableHeader>

      <ListItemSelectedState selected="indeterminate-or-all">
        <TableHeader>
          <TableCellFirst>
            <SelectAllCheckbox
              listItemCheckboxState={listItemCheckboxState}
              projects={projects}
            />
          </TableCellFirst>
          <TableCellsRemainingContent align="center" gap="md">
            <PreferredAgentDropdownMenu
              isDisabled={!canWrite}
              onChange={value => {
                mutate(
                  {
                    query: '',
                    projectIds,
                    agent: value,
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
                    onSuccess: () =>
                      addSuccessMessage(
                        tn(
                          'Agent updated for %s project',
                          'Agent updated for %s projects',
                          projectIds.length
                        )
                      ),
                  }
                );
              }}
            />
            <StoppingPointDropdownMenu
              isDisabled={!canWrite}
              onChange={value => {
                mutate(
                  {
                    query: '',
                    projectIds,
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
                    onSuccess: () =>
                      addSuccessMessage(
                        tn(
                          'Stopping point updated for %s project',
                          'Stopping point updated for %s projects',
                          projectIds.length
                        )
                      ),
                  }
                );
              }}
            />

            {/* <DropdownMenu
              isDisabled={!canWrite}
              size="xs"
              items={
                agentOptions.data?.map(({value, label}) => ({
                  key: typeof value === 'object' ? value.provider : value,
                  label,
                  onAction: () => {
                    // const selectedProjects = projects.filter(p =>
                    //   projectIds.includes(p.id)
                    // );
                    // bulkMutateSelectedAgent(selectedProjects, value);

                    mutate({
                      query: '',
                      projectIds,
                      agent: value,
                    });
                  },
                })) ?? []
              }
              triggerLabel={t('Agent')}
              menuFooter={
                <DropdownMenuFooter>
                  <Link
                    to={{
                      pathname: `/settings/${organization.slug}/integrations/`,
                      query: {category: 'coding agent'},
                    }}
                  >
                    {t('Manage Coding Agents')}
                  </Link>
                </DropdownMenuFooter>
              }
            /> */}
            {/* <DropdownMenu
              isDisabled={!canWrite}
              size="xs"
              items={PROJECT_STOPPING_POINT_OPTIONS.map(option => ({
                key: option.value,
                label: option.label,
                onAction: () => {
                  mutate({
                    query: '',
                    projectIds,
                    stoppingPoint: value,
                  });

                  // if (option.value === 'off') {
                  //   updateBulkAutofixAutomationSettings(
                  //     {projectIds, autofixAutomationTuning: 'off'},
                  //     getMutationCallbacks(projectIds.length)
                  //   );
                  // } else {
                  //   const stoppingPointMap = {
                  //     root_cause: 'root_cause' as const,
                  //     plan: 'code_changes' as const,
                  //     create_pr: 'open_pr' as const,
                  //   };
                  //   updateBulkAutofixAutomationSettings(
                  //     {
                  //       projectIds,
                  //       autofixAutomationTuning: 'medium',
                  //       automatedRunStoppingPoint: stoppingPointMap[option.value],
                  //     },
                  //     getMutationCallbacks(projectIds.length)
                  //   );
                  // }
                },
              }))}
              triggerLabel={t('Automation Steps')}
              menuFooter={
                <DropdownMenuFooter>
                  <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/seer/autofix/#how-issue-autofix-works">
                    <Flex gap="sm" align="center">
                      <IconOpen size="xs" />
                      {t('Read the Docs')}
                    </Flex>
                  </ExternalLink>
                </DropdownMenuFooter>
              }
            /> */}
          </TableCellsRemainingContent>
        </TableHeader>
      </ListItemSelectedState>

      <ListItemSelectedState selected="indeterminate">
        <FullGridAlert variant="info" system>
          <Flex justify="start" width="100%" wrap="wrap" gap="md">
            {tn('Selected %s project.', 'Selected %s projects.', countSelected)}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all [count] projects that match: [queryString].', {
                    count: listItemCheckboxState.hits,
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all %s projects.', listItemCheckboxState.hits)}
            </a>
          </Flex>
        </FullGridAlert>
      </ListItemSelectedState>

      <ListItemSelectedState selected="all">
        <FullGridAlert variant="info" system>
          {queryString
            ? tct('Selected all [count] projects matching: [queryString].', {
                count: countSelected,
                queryString: <var>{queryString}</var>,
              })
            : countSelected > projects.length
              ? t('Selected all %s+ projects.', projects.length)
              : tn('Selected %s project.', 'Selected all %s projects.', countSelected)}
        </FullGridAlert>
      </ListItemSelectedState>
    </Fragment>
  );
}

function SelectAllCheckbox({
  listItemCheckboxState: {deselectAll, isAllSelected, selectedIds, selectAll},
  projects,
}: {
  listItemCheckboxState: ListItemCheckboxState;
  projects: SeerProjectSettingResponse[];
}) {
  return (
    <Checkbox
      id="project-table-select-all"
      checked={isAllSelected}
      disabled={projects.length === 0}
      onChange={() => {
        if (isAllSelected === true || selectedIds.length === projects.length) {
          deselectAll();
        } else {
          selectAll();
        }
      }}
    />
  );
}

const TableHeader = styled(InfiniteTable.Header)`
  grid-row: 1;
  z-index: ${p => p.theme.zIndex.initial};
  height: min-content;
`;

const TableCellFirst = styled(InfiniteTable.HeaderCell)`
  grid-column: 1;
`;

const TableCellsRemainingContent = styled(Flex)`
  grid-column: 2 / -1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
