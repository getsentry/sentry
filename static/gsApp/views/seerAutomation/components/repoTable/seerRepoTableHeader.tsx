import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex} from '@sentry/scraps/layout/flex';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {Sort} from 'sentry/utils/discover/fields';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {parseQueryKey} from 'sentry/utils/queryClient';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import type {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';

interface Props {
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  onSortClick: (key: Sort) => void;
  repositories: RepositoryWithSettings[];
  sort: Sort;
}

const COLUMNS = [
  {title: t('Name'), key: 'name', sortKey: 'name'},
  {title: t('Projects'), key: 'projects'},
  {title: t('Code Review'), key: 'code_review'},
];

export default function SeerRepoTableHeader({
  onSortClick,
  repositories,
  sort,
  mutateRepositorySettings,
}: Props) {
  const canWrite = useCanWriteSettings();
  const listItemCheckboxState = useListItemCheckboxContext();
  const {countSelected, isAllSelected, isAnySelected, queryKey, selectAll, selectedIds} =
    listItemCheckboxState;
  const queryOptions = parseQueryKey(queryKey).options;
  const queryString = queryOptions?.query?.query;

  const handleBulkCodeReview = (enabledCodeReview: boolean) => {
    const repositoryIds =
      selectedIds === 'all' ? repositories.map(repo => repo.id) : selectedIds;
    mutateRepositorySettings(
      {
        enabledCodeReview,
        repositoryIds,
      },
      {
        onError: () => {
          addErrorMessage(
            tn(
              'Failed to update code review for %s repository',
              'Failed to update code review for %s repositories',
              repositoryIds.length
            )
          );
        },
        onSuccess: () => {
          addSuccessMessage(
            tn(
              'Code review updated for %s repository',
              'Code review updated for %s repositories',
              repositoryIds.length
            )
          );
        },
      }
    );
  };

  return (
    <Fragment>
      <TableHeader>
        <SimpleTable.HeaderCell>
          <SelectAllCheckbox
            listItemCheckboxState={listItemCheckboxState}
            repositories={repositories}
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
              repositories={repositories}
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
                  onAction: () => handleBulkCodeReview(true),
                },
                {
                  key: 'off',
                  label: t('Off'),
                  onAction: () => handleBulkCodeReview(false),
                },
              ]}
              triggerLabel={t('Code Review')}
            />
          </TableCellsRemainingContent>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap" gap="md">
            {tn('Selected %s repository.', 'Selected %s repositories.', countSelected)}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all repositories that match: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all repositories.')}
            </a>
          </Flex>
        </FullGridAlert>
      ) : null}

      {isAllSelected === true ? (
        <FullGridAlert variant="warning" system>
          <Flex justify="center" wrap="wrap">
            <span>
              {queryString
                ? tct('Selected all repositories matching: [queryString].', {
                    queryString: <var>{queryString}</var>,
                  })
                : countSelected > repositories.length
                  ? t('Selected all %s+ repositories.', repositories.length)
                  : tn(
                      'Selected %s repository.',
                      'Selected all %s repositories.',
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
  repositories,
}: {
  listItemCheckboxState: ReturnType<typeof useListItemCheckboxContext>;
  repositories: RepositoryWithSettings[];
}) {
  return (
    <Checkbox
      id="repository-table-select-all"
      checked={isAllSelected}
      disabled={repositories.length === 0}
      onChange={() => {
        if (isAllSelected === true || selectedIds.length === repositories.length) {
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
