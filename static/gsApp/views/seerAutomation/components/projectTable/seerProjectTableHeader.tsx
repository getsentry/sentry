import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Checkbox} from '@sentry/scraps/checkbox';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {useUpdateBulkAutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  useBulkMutateSelectedAgent,
  useFetchAgentOptions,
} from 'sentry/views/settings/seer/overview/utils/seerPreferredAgent';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  onSortClick: (key: Sort) => void;
  projects: Project[];
  sort: Sort;
  updateBulkAutofixAutomationSettings: ReturnType<
    typeof useUpdateBulkAutofixAutomationSettings
  >['mutate'];
}

const COLUMNS = [
  {title: t('Project'), key: 'project', sortKey: 'project'},
  {
    title: ({organization}: {organization: Organization}) => (
      <Flex gap="sm" align="center">
        {t('Preferred Coding Agent')}
        <InfoTip
          title={tct(
            'Select the coding agent to use when proposing code changes. [manageLink:Manage Coding Agent Integrations]',
            {
              manageLink: (
                <Link
                  to={{
                    pathname: normalizeUrl(
                      `/settings/${organization.slug}/integrations/`
                    ),
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
        {t('PR Creation')}
        <InfoTip
          title={t(
            'This setting only applies when an Autofix Handoff is configured to run automatically.'
          )}
        />
      </Flex>
    ),
    key: 'pr_creation',
  },
  {title: t('Repos'), key: 'repos', sortKey: 'repo_count'},
];

function getMutationCallbacks(count: number) {
  return {
    onError: () =>
      addErrorMessage(
        tn(
          'Failed to update settings for %s project',
          'Failed to update settings for %s projects',
          count
        )
      ),
    onSuccess: () =>
      addSuccessMessage(
        tn('Settings updated for %s project', 'Settings updated for %s projects', count)
      ),
  };
}

export function ProjectTableHeader({
  projects,
  onSortClick,
  sort,
  updateBulkAutofixAutomationSettings,
}: Props) {
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const listItemCheckboxState = useListItemCheckboxContext();
  const {
    countSelected,
    isAllSelected,
    isAnySelected,
    queryKeyRef,
    selectAll,
    selectedIds,
  } = listItemCheckboxState;
  const queryOptions = queryKeyRef.current
    ? parseQueryKey(queryKeyRef.current).options
    : undefined;
  const queryString = queryOptions?.query?.query;

  const projectIds = useMemo(
    () => (selectedIds === 'all' ? projects.map(project => project.id) : selectedIds),
    [projects, selectedIds]
  );

  const agentOptions = useFetchAgentOptions({organization});
  const bulkMutateSelectedAgent = useBulkMutateSelectedAgent();

  return (
    <Fragment>
      <TableHeader>
        <SimpleTable.HeaderCell>
          <SelectAllCheckbox
            listItemCheckboxState={listItemCheckboxState}
            projects={projects}
          />
        </SimpleTable.HeaderCell>
        {COLUMNS.map(({title, key, sortKey}) => (
          <SimpleTable.HeaderCell
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
          </SimpleTable.HeaderCell>
        ))}
      </TableHeader>

      {isAnySelected ? (
        <TableHeader>
          <TableCellFirst>
            <SelectAllCheckbox
              listItemCheckboxState={listItemCheckboxState}
              projects={projects}
            />
          </TableCellFirst>
          <TableCellsRemainingContent align="center" gap="md">
            <DropdownMenu
              isDisabled={!canWrite}
              size="xs"
              items={
                agentOptions.data?.map(({value, label}) => ({
                  key: typeof value === 'object' ? value.provider : value,
                  label,
                  onAction: () => {
                    const selectedProjects = projects.filter(p =>
                      projectIds.includes(p.id)
                    );
                    bulkMutateSelectedAgent(selectedProjects, value);
                  },
                })) ?? []
              }
              triggerLabel={t('Agent')}
            />
            <DropdownMenu
              isDisabled={!canWrite || organization.enableSeerCoding === false}
              size="xs"
              items={[
                {
                  key: 'open_pr',
                  label: t('On'),
                  onAction: () =>
                    updateBulkAutofixAutomationSettings(
                      {projectIds, automatedRunStoppingPoint: 'open_pr'},
                      getMutationCallbacks(projectIds.length)
                    ),
                },
                {
                  key: 'code_changes',
                  label: t('Off'),
                  onAction: () =>
                    updateBulkAutofixAutomationSettings(
                      {projectIds, automatedRunStoppingPoint: 'code_changes'},
                      getMutationCallbacks(projectIds.length)
                    ),
                },
              ]}
              triggerLabel={t('Create PRs')}
            />
          </TableCellsRemainingContent>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap" gap="md">
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
      ) : null}

      {isAllSelected === true ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap">
            <span>
              {queryString
                ? tct('Selected all [count] projects matching: [queryString].', {
                    count: countSelected,
                    queryString: <var>{queryString}</var>,
                  })
                : countSelected > projects.length
                  ? t('Selected all %s+ projects.', projects.length)
                  : tn(
                      'Selected %s project.',
                      'Selected all %s projects.',
                      countSelected
                    )}
            </span>
          </Flex>
        </FullGridAlert>
      ) : null}
    </Fragment>
  );
}

function SelectAllCheckbox({
  listItemCheckboxState: {deselectAll, isAllSelected, selectedIds, selectAll},
  projects,
}: {
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
  projects: Project[];
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

const TableHeader = styled(SimpleTable.Header)`
  grid-row: 1;
  z-index: ${p => p.theme.zIndex.initial};
  height: min-content;
`;

const TableCellFirst = styled(SimpleTable.HeaderCell)`
  grid-column: 1;
`;

const TableCellsRemainingContent = styled(Flex)`
  grid-column: 2 / -1;
`;

const FullGridAlert = styled(Alert)`
  grid-column: 1 / -1;
`;
