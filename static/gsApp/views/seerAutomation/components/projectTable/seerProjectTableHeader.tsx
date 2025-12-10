import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
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
}

const COLUMNS = [
  {title: t('Project'), key: 'project', sortKey: 'project'},
  {title: t('Auto Fix'), key: 'fixes'},
  {title: t('PR Creation'), key: 'pr_creation'},
  {title: t('Background Agent'), key: 'is_delegated'},
  {title: t('Repos'), key: 'repos'},
];

export default function ProjectTableHeader({projects, onSortClick, sort}: Props) {
  const canWrite = useCanWriteSettings();
  const listItemCheckboxState = useListItemCheckboxContext();
  const {
    countSelected,
    isAllSelected,
    isAnySelected,
    queryKey,
    selectAll,
    selectedIds: _selectedIds,
  } = listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  const handleBulkAutoFix = (_value: 'on' | 'off') => {
    // const autofixAutomationTuning = value ? 'medium' : 'off';
    // Set project.autofixAutomationTuning for all _selectedIds
    // See: useUpdateProjectAutomation()
  };
  const handleBulkPRCreate = (_value: 'on' | 'off') => {
    // const automatedRunStoppingPoint = value ? 'open_pr' : 'code_changes';
    // Set preferences.automated_run_stopping_point for all _selectedIds
    // See: useUpdateProjectSeerPreferences()
  };

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
                  key: 'on',
                  label: t('On'),
                  onAction: () => handleBulkAutoFix('on'),
                },
                {
                  key: 'off',
                  label: t('Off'),
                  onAction: () => handleBulkAutoFix('off'),
                },
              ]}
              triggerLabel={t('Auto Fix')}
            />
            <DropdownMenu
              isDisabled={!canWrite}
              size="xs"
              items={[
                {
                  key: 'on',
                  label: t('On'),
                  onAction: () => handleBulkPRCreate('on'),
                },
                {
                  key: 'off',
                  label: t('Off'),
                  onAction: () => handleBulkPRCreate('off'),
                },
              ]}
              triggerLabel={t('PR Creation')}
            />
          </TableCellsRemainingContent>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert type="warning" system>
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
        <FullGridAlert type="warning" system>
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
