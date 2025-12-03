import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Button} from '@sentry/scraps/button/button';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';

interface Props {
  projects: Project[];
  onSortClick?: (key: string) => void;
  sort?: Sort;
}

export default function ProjectTableHeader({projects, onSortClick, sort}: Props) {
  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, isAllSelected, isAnySelected, queryKey, selectAll, selectedIds} =
    listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  return (
    <Fragment>
      <TableHeader>
        <SimpleTable.HeaderCell>
          <SelectAllCheckbox
            listItemCheckboxState={listItemCheckboxState}
            projects={projects}
          />
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Project')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Fixes')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('PR Creation')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Repos')}</SimpleTable.HeaderCell>
      </TableHeader>

      {isAnySelected ? (
        <TableHeader>
          <TableCellFirst>
            {/* <ReplaySelectColumn.Header
              columnIndex={0}
              listItemCheckboxState={listItemCheckboxState}
              replays={replays}
            /> */}
            <SelectAllCheckbox
              listItemCheckboxState={listItemCheckboxState}
              projects={projects}
            />
          </TableCellFirst>
          <TableCellsRemainingContent align="center" gap="md">
            <Button size="xs">Issue Fix?</Button>
            <Button size="xs">PR Creation</Button>
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
