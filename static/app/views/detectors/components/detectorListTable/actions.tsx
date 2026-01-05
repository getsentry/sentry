import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useDeleteDetectorsMutation} from 'sentry/views/detectors/hooks/useDeleteDetectorsMutation';
import {useUpdateDetectorsMutation} from 'sentry/views/detectors/hooks/useEditDetectorsMutation';

interface DetectorsTableActionsProps {
  allResultsVisible: boolean;
  canEdit: boolean;
  detectorLimitReached: boolean;
  hasSystemCreatedDetectors: boolean;
  pageSelected: boolean;
  queryCount: string;
  selected: Set<string>;
  showDisable: boolean;
  showEnable: boolean;
  togglePageSelected: (pageSelected: boolean) => void;
}

export function DetectorsTableActions({
  selected,
  pageSelected,
  togglePageSelected,
  queryCount,
  allResultsVisible,
  showEnable,
  showDisable,
  canEdit,
  hasSystemCreatedDetectors,
  detectorLimitReached,
}: DetectorsTableActionsProps) {
  const [allInQuerySelected, setAllInQuerySelected] = useState(false);
  const anySelected = selected.size > 0;

  const canDelete = canEdit && !hasSystemCreatedDetectors;

  const {selection} = usePageFilters();
  const {query} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  const {mutateAsync: deleteDetectors, isPending: isDeleting} =
    useDeleteDetectorsMutation();
  const {mutateAsync: updateDetectors, isPending: isUpdating} =
    useUpdateDetectorsMutation();

  const getEnableConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to enable all [queryCount] monitors that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to enable this %s monitor?`,
      `Are you sure you want to enable these %s monitors?`,
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const getDisableConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to disable all [queryCount] monitors that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to disable this %s monitor?`,
      `Are you sure you want to disable these %s monitors?`,
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const handleUpdate = useCallback(
    ({enabled}: {enabled: boolean}) => {
      openConfirmModal({
        message: enabled ? getEnableConfirmMessage() : getDisableConfirmMessage(),
        confirmText: enabled ? t('Enable') : t('Disable'),
        priority: 'danger',
        onConfirm: async () => {
          if (allInQuerySelected) {
            await updateDetectors({enabled, query, projects: selection.projects});
          } else {
            await updateDetectors({enabled, ids: Array.from(selected)});
          }
          togglePageSelected(false);
        },
      });
    },
    [
      selected,
      allInQuerySelected,
      updateDetectors,
      getEnableConfirmMessage,
      getDisableConfirmMessage,
      togglePageSelected,
      selection.projects,
      query,
    ]
  );

  const getDeleteConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to delete all [queryCount] monitors that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to delete this %s monitor?`,
      `Are you sure you want to delete these %s monitors?`,
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: getDeleteConfirmMessage(),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: async () => {
        if (allInQuerySelected) {
          await deleteDetectors({query, projects: selection.projects});
        } else {
          await deleteDetectors({ids: Array.from(selected)});
        }
        togglePageSelected(false);
      },
    });
  }, [
    selected,
    allInQuerySelected,
    deleteDetectors,
    getDeleteConfirmMessage,
    togglePageSelected,
    selection.projects,
    query,
  ]);

  return (
    <Fragment>
      <SimpleTable.Header>
        <ActionsBarWrapper>
          <Checkbox
            checked={pageSelected || (anySelected ? 'indeterminate' : false)}
            onChange={s => {
              togglePageSelected(s.target.checked);
              setAllInQuerySelected(false);
            }}
          />
          {showEnable && (
            <Tooltip
              title={
                canEdit
                  ? detectorLimitReached
                    ? "You've reached your plan's limit on metric monitors."
                    : ''
                  : 'You do not have permission to modify the selected monitors.'
              }
              disabled={canEdit && !detectorLimitReached}
            >
              <Button
                size="xs"
                onClick={() => handleUpdate({enabled: true})}
                disabled={isUpdating || !canEdit || detectorLimitReached}
              >
                {t('Enable')}
              </Button>
            </Tooltip>
          )}
          {showDisable && (
            <Tooltip
              title="You do not have permission to modify the selected monitors."
              disabled={canEdit}
            >
              <Button
                size="xs"
                onClick={() => handleUpdate({enabled: false})}
                disabled={isUpdating || !canEdit}
              >
                {t('Disable')}
              </Button>
            </Tooltip>
          )}
          <Tooltip
            title={
              hasSystemCreatedDetectors
                ? t('Monitors managed by Sentry cannot be deleted.')
                : t('You do not have permission to delete the selected monitors.')
            }
            disabled={canDelete}
          >
            <Button
              size="xs"
              priority="danger"
              onClick={handleDelete}
              disabled={isDeleting || !canDelete}
            >
              {t('Delete')}
            </Button>
          </Tooltip>
        </ActionsBarWrapper>
      </SimpleTable.Header>
      {pageSelected && !allResultsVisible && (
        <FullWidthAlert variant="warning" system showIcon={false}>
          <Flex justify="center" wrap="wrap" gap="md">
            {allInQuerySelected ? (
              tct('Selected all [count] monitors that match this search query.', {
                count: queryCount,
              })
            ) : (
              <Fragment>
                {tn(
                  '%s monitor on this page selected.',
                  '%s monitors on this page selected.',
                  selected.size
                )}
                <Button priority="link" onClick={() => setAllInQuerySelected(true)}>
                  {tct('Select all [count] monitors that match this search query.', {
                    count: queryCount,
                  })}
                </Button>
              </Fragment>
            )}
          </Flex>
        </FullWidthAlert>
      )}
    </Fragment>
  );
}

const FullWidthAlert = styled(Alert)`
  grid-column: 1 / -1;
`;

const ActionsBarWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.md};
  padding: 0 ${p => p.theme.space.xl};
  width: 100%;
  grid-column: 1 / -1;
`;
