import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import type {useUpdateBulkAutofixAutomationSettings} from 'sentry/components/events/autofix/preferences/hooks/useBulkAutofixAutomationSettings';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

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
  {title: t('Auto Fix'), key: 'fixes'},
  {title: t('PR Creation'), key: 'pr_creation'},
  {
    title: (
      <Flex gap="sm">
        {t('Background Agent')}
        <QuestionTooltip
          title={t(
            'Background Agent delegation can only be enabled on the individual project settings page. Backgroud agents can have their own settings that are not shown here.'
          )}
          size="xs"
        />
      </Flex>
    ),
    key: 'is_delegated',
  },
  {title: t('Repos'), key: 'repos'},
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

export default function ProjectTableHeader({
  projects,
  onSortClick,
  sort,
  updateBulkAutofixAutomationSettings,
}: Props) {
  const canWrite = useCanWriteSettings();
  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, isAllSelected, isAnySelected, queryKey, selectAll, selectedIds} =
    listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  const projectIds = useMemo(
    () => (selectedIds === 'all' ? projects.map(project => project.id) : selectedIds),
    [projects, selectedIds]
  );

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
            {title}
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
              items={[
                {
                  key: 'medium',
                  label: t('On'),
                  onAction: () =>
                    updateBulkAutofixAutomationSettings(
                      {projectIds, autofixAutomationTuning: 'medium'},
                      getMutationCallbacks(projectIds.length)
                    ),
                },
                {
                  key: 'off',
                  label: t('Off'),
                  onAction: () =>
                    updateBulkAutofixAutomationSettings(
                      {projectIds, autofixAutomationTuning: 'off'},
                      getMutationCallbacks(projectIds.length)
                    ),
                },
              ]}
              triggerLabel={t('Auto Fix')}
            />
            <DropdownMenu
              isDisabled={!canWrite}
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
              triggerLabel={t('PR Creation')}
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
                ? tct('Select all projects that match: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all projects.')}
            </a>
          </Flex>
        </FullGridAlert>
      ) : null}

      {isAllSelected === true ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap">
            <span>
              {queryString
                ? tct('Selected all projects matching: [queryString].', {
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
