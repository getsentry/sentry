import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {Checkbox} from '@sentry/scraps/checkbox';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import type {useBulkUpdateRepositorySettings} from 'sentry/components/repositories/useBulkUpdateRepositorySettings';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import type {RepositoryWithSettings} from 'sentry/types/integrations';
import type {CodeReviewTrigger} from 'sentry/types/seer';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import type {Sort} from 'sentry/utils/discover/fields';
import {
  useListItemCheckboxContext,
  type ListItemCheckboxState,
} from 'sentry/utils/list/useListItemCheckboxState';

import {useCanWriteSettings} from 'getsentry/views/seerAutomation/components/useCanWriteSettings';

interface Props {
  gridColumns: string;
  isFetchingNextPage: boolean;
  isPending: boolean;
  mutateRepositorySettings: ReturnType<
    typeof useBulkUpdateRepositorySettings
  >['mutateAsync'];
  onSortClick: (key: Sort) => void;
  repositories: RepositoryWithSettings[];
  sort: Sort;
}

const COLUMNS = [
  {title: t('Name'), key: 'name', sortKey: 'name'},
  {title: t('Code Review'), key: 'code_review', sortKey: 'enabled'},
  {
    title: (
      <Flex gap="sm" align="center">
        {t('Trigger')}
        <InfoTip
          title={tct(
            'Code review can always be triggered manaully by mentioning [code:@sentry review].',
            {code: <code />}
          )}
        />
      </Flex>
    ),
    key: 'trigger',
    sortKey: 'triggers',
  },
];

export function SeerRepoTableHeader({
  gridColumns,
  isFetchingNextPage,
  isPending,
  mutateRepositorySettings,
  onSortClick,
  repositories,
  sort,
}: Props) {
  const canWrite = useCanWriteSettings();
  const listItemCheckboxState = useListItemCheckboxContext();
  const {
    countSelected,
    isAllSelected,
    isAnySelected,
    queryKeyRef,
    selectAll,
    selectedIds,
    knownIds,
  } = listItemCheckboxState;
  const queryOptions = queryKeyRef.current
    ? parseQueryKey(queryKeyRef.current).options
    : undefined;
  const queryString = queryOptions?.query?.query as string | undefined;

  const selectedRepos = useMemo(() => {
    if (selectedIds === 'all') {
      return repositories;
    }
    return repositories.filter(repo => selectedIds.includes(repo.id));
  }, [repositories, selectedIds]);

  const currentCodeReviewValue = useMemo(() => {
    const someEnabled = selectedRepos.some(repo => repo?.settings?.enabledCodeReview);
    const someDisabled = selectedRepos.some(
      repo => repo?.settings?.enabledCodeReview === false
    );
    if (someEnabled && someDisabled) {
      return;
    }
    if (someEnabled) {
      return 'enabled_code_review:enabled';
    }
    if (someDisabled) {
      return 'enabled_code_review:disabled';
    }
    return;
  }, [selectedRepos]);

  const currentTriggersValue = useMemo((): CodeReviewTrigger[] => {
    const everyOnReadyForReview = selectedRepos.every(repo =>
      repo?.settings?.codeReviewTriggers?.includes('on_ready_for_review')
    );
    const everyOnNewCommit = selectedRepos.every(repo =>
      repo?.settings?.codeReviewTriggers?.includes('on_new_commit')
    );
    return [
      ...(everyOnReadyForReview ? ['on_ready_for_review' as const] : []),
      ...(everyOnNewCommit ? ['on_new_commit' as const] : []),
    ];
  }, [selectedRepos]);

  const [isBulkUpdating, setIsBulkUpdating] = useState(false);

  const handleBulkCodeReview = async (enabledCodeReview: boolean) => {
    const repositoryIds = selectedIds === 'all' ? knownIds : selectedIds;
    setIsBulkUpdating(true);
    addLoadingMessage(
      tn(
        'Updating code review for %s repository…',
        'Updating code review for %s repositories…',
        repositoryIds.length
      )
    );
    try {
      await mutateRepositorySettings({enabledCodeReview, repositoryIds});
      addSuccessMessage(
        tn(
          'Code review updated for %s repository',
          'Code review updated for %s repositories',
          repositoryIds.length
        )
      );
    } catch {
      addErrorMessage(
        tn(
          'Failed to update code review for %s repository',
          'Failed to update code review for %s repositories',
          repositoryIds.length
        )
      );
    } finally {
      setIsBulkUpdating(false);
    }
  };

  const handleBulkTriggers = async ({
    added,
    removed,
  }: {
    added: CodeReviewTrigger | undefined;
    removed: CodeReviewTrigger | undefined;
  }) => {
    const promises: Array<Promise<unknown>> = [];

    if (added) {
      const repoIdsWithZeroTriggers: string[] = [];
      const repoIdsWithOneTrigger: string[] = [];
      for (const repo of selectedRepos) {
        if (!repo.settings?.codeReviewTriggers?.length) {
          repoIdsWithZeroTriggers.push(repo.id);
        } else if (!repo.settings?.codeReviewTriggers?.includes(added)) {
          repoIdsWithOneTrigger.push(repo.id);
        }
      }
      // Some items start with 0 triggers, they'll be saved with 1 new trigger
      if (repoIdsWithZeroTriggers.length > 0) {
        promises.push(
          mutateRepositorySettings({
            codeReviewTriggers: [added],
            repositoryIds: repoIdsWithZeroTriggers,
          })
        );
      }
      // Some items start with 1 trigger, they'll be saved with 1 new trigger for a total of 2
      if (repoIdsWithOneTrigger.length > 0) {
        promises.push(
          mutateRepositorySettings({
            codeReviewTriggers: ['on_new_commit', 'on_ready_for_review'],
            repositoryIds: repoIdsWithOneTrigger,
          })
        );
      }
    }
    if (removed) {
      const repoIdsWithOneTrigger: string[] = [];
      const repoIdsWithTwoTriggers: string[] = [];
      for (const repo of selectedRepos) {
        if (repo.settings?.codeReviewTriggers?.length === 2) {
          repoIdsWithTwoTriggers.push(repo.id);
        } else if (repo.settings?.codeReviewTriggers?.includes(removed)) {
          repoIdsWithOneTrigger.push(repo.id);
        }
      }
      // Some items start with 2 triggers, we'll remove one
      const remainingTrigger =
        removed === 'on_new_commit' ? 'on_ready_for_review' : 'on_new_commit';
      if (repoIdsWithTwoTriggers.length > 0) {
        promises.push(
          mutateRepositorySettings({
            codeReviewTriggers: [remainingTrigger],
            repositoryIds: repoIdsWithTwoTriggers,
          })
        );
      }
      // Some items start with 1 trigger, we'll remove it
      if (repoIdsWithOneTrigger.length > 0) {
        promises.push(
          mutateRepositorySettings({
            codeReviewTriggers: [],
            repositoryIds: repoIdsWithOneTrigger,
          })
        );
      }
    }

    if (promises.length === 0) {
      return;
    }

    setIsBulkUpdating(true);
    addLoadingMessage(t('Updating triggers…'));

    const results = await Promise.allSettled(promises);
    const hasError = results.some(r => r.status === 'rejected');
    setIsBulkUpdating(false);

    if (hasError) {
      addErrorMessage(t('Failed to update triggers'));
    } else {
      addSuccessMessage(t('Triggers updated'));
    }
  };

  return (
    <Fragment>
      {isAnySelected ? null : (
        <TableHeader gridColumns={gridColumns}>
          <SimpleTable.HeaderCell>
            <SelectAllCheckbox
              disabled={isPending || isFetchingNextPage}
              knownIds={knownIds}
              listItemCheckboxState={listItemCheckboxState}
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
      )}

      {isAnySelected ? (
        <TableHeader gridColumns={gridColumns}>
          <TableCellFirst>
            <SelectAllCheckbox
              disabled={isPending || isFetchingNextPage}
              knownIds={knownIds}
              listItemCheckboxState={listItemCheckboxState}
            />
          </TableCellFirst>
          <TableCellsRemainingContent align="center" gap="md">
            <CompactSelect
              disabled={!canWrite}
              size="xs"
              trigger={props => (
                <OverlayTrigger.Button {...props}>
                  {t('Code Review')}
                </OverlayTrigger.Button>
              )}
              options={[
                {
                  value: 'enabled_code_review:enabled',
                  label: t('Enable'),
                  disabled: isBulkUpdating,
                },
                {
                  value: 'enabled_code_review:disabled',
                  label: t('Disable'),
                  disabled: isBulkUpdating,
                },
              ]}
              value={currentCodeReviewValue}
              onChange={option => {
                if (option.value === 'enabled_code_review:enabled') {
                  handleBulkCodeReview(true);
                } else {
                  handleBulkCodeReview(false);
                }
              }}
            />

            <CompactSelect<CodeReviewTrigger>
              disabled={!canWrite}
              multiple
              size="xs"
              trigger={props => (
                <OverlayTrigger.Button {...props}>{t('Triggers')}</OverlayTrigger.Button>
              )}
              options={[
                {
                  value: 'on_ready_for_review',
                  label: t('On Ready for Review'),
                  disabled: isBulkUpdating,
                },
                {
                  value: 'on_new_commit',
                  label: t('On New Commit'),
                  disabled: isBulkUpdating,
                },
              ]}
              value={currentTriggersValue}
              onChange={option => {
                const value = option.map(v => v.value);
                const added = value.findLast(v => !currentTriggersValue.includes(v));
                const removed = currentTriggersValue.findLast(v => !value.includes(v));
                handleBulkTriggers({added, removed});
              }}
            />
          </TableCellsRemainingContent>
        </TableHeader>
      ) : null}

      {isAllSelected === 'indeterminate' ? (
        <FullGridAlert variant="info" system>
          <Flex justify="start" width="100%" wrap="wrap" gap="md">
            {tn('Selected %s repository.', 'Selected %s repositories.', countSelected)}
            <a onClick={selectAll}>
              {queryString
                ? tct('Select all [count] repositories that match: [queryString].', {
                    count: listItemCheckboxState.hits,
                    queryString: <var>{queryString}</var>,
                  })
                : t('Select all %s repositories.', listItemCheckboxState.hits)}
            </a>
          </Flex>
        </FullGridAlert>
      ) : null}

      {isAllSelected === true ? (
        <FullGridAlert variant="info" system>
          {queryString
            ? tct('Selected all [count] repositories matching: [queryString].', {
                count: countSelected,
                queryString: <var>{queryString}</var>,
              })
            : countSelected > knownIds.length
              ? t('Selected all %s+ repositories.', knownIds.length)
              : tn(
                  'Selected %s repository.',
                  'Selected all %s repositories.',
                  countSelected
                )}
        </FullGridAlert>
      ) : null}
    </Fragment>
  );
}

function SelectAllCheckbox({
  listItemCheckboxState: {deselectAll, isAllSelected, selectedIds, selectAll},
  knownIds,
  disabled,
}: {
  disabled: boolean;
  knownIds: string[];
  listItemCheckboxState: ListItemCheckboxState;
}) {
  return (
    <Checkbox
      id="repository-table-select-all"
      checked={isAllSelected}
      disabled={knownIds.length === 0 || disabled}
      onChange={() => {
        if (isAllSelected === true || selectedIds.length === knownIds.length) {
          deselectAll();
        } else {
          selectAll();
        }
      }}
    />
  );
}

const TableHeader = styled(SimpleTable.Header)<{gridColumns: string}>`
  grid-template-columns: ${p => p.gridColumns};
  grid-column: unset;
  grid-row: unset;
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
