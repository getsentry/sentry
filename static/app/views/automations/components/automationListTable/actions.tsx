import {Fragment, useCallback, useState} from 'react';
import styled from '@emotion/styled';

import {openConfirmModal} from 'sentry/components/confirm';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import usePageFilters from 'sentry/utils/usePageFilters';
import {
  useDeleteAutomationsMutation,
  useUpdateAutomationsMutation,
} from 'sentry/views/automations/hooks';

interface AutomationsTableActionsProps {
  allResultsVisible: boolean;
  canDisable: boolean;
  canEnable: boolean;
  pageSelected: boolean;
  queryCount: string;
  selected: Set<string>;
  togglePageSelected: (pageSelected: boolean) => void;
}

export function AutomationsTableActions({
  selected,
  pageSelected,
  togglePageSelected,
  queryCount,
  allResultsVisible,
  canEnable,
  canDisable,
}: AutomationsTableActionsProps) {
  const [allInQuerySelected, setAllInQuerySelected] = useState(false);
  const anySelected = selected.size > 0;

  const {selection} = usePageFilters();
  const {query} = useLocationQuery({
    fields: {
      query: decodeScalar,
    },
  });

  const {mutateAsync: deleteAutomations, isPending: isDeleting} =
    useDeleteAutomationsMutation();
  const {mutateAsync: updateAutomations, isPending: isUpdating} =
    useUpdateAutomationsMutation();

  const getEnableConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to enable all [queryCount] automations that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to enable this %s automation?`,
      `Are you sure you want to enable these %s automations?`,
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const getDisableConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to disable all [queryCount] automations that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to disable this %s automation?`,
      `Are you sure you want to disable these %s automations?`,
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
            await updateAutomations({enabled, query, projects: selection.projects});
          } else {
            await updateAutomations({enabled, ids: Array.from(selected)});
          }
          togglePageSelected(false);
        },
      });
    },
    [
      selected,
      allInQuerySelected,
      updateAutomations,
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
        'Are you sure you want to delete all [queryCount] automations that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      `Are you sure you want to delete this %s automation?`,
      `Are you sure you want to delete these %s automations?`,
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
          await deleteAutomations({query, projects: selection.projects});
        } else {
          await deleteAutomations({ids: Array.from(selected)});
        }
        togglePageSelected(false);
      },
    });
  }, [
    selected,
    allInQuerySelected,
    deleteAutomations,
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
          {canEnable && (
            <Button
              size="xs"
              onClick={() => handleUpdate({enabled: true})}
              disabled={isUpdating}
            >
              {t('Enable')}
            </Button>
          )}
          {canDisable && (
            <Button
              size="xs"
              onClick={() => handleUpdate({enabled: false})}
              disabled={isUpdating}
            >
              {t('Disable')}
            </Button>
          )}
          <Button
            size="xs"
            priority="danger"
            onClick={handleDelete}
            disabled={isDeleting}
          >
            {t('Delete')}
          </Button>
        </ActionsBarWrapper>
      </SimpleTable.Header>
      {pageSelected && !allResultsVisible && (
        <FullWidthAlert variant="warning" system showIcon={false}>
          <Flex justify="center" wrap="wrap" gap="md">
            {allInQuerySelected ? (
              tct('Selected all [count] alerts that match this search query.', {
                count: queryCount,
              })
            ) : (
              <Fragment>
                {tn(
                  '%s alert on this page selected.',
                  '%s alerts on this page selected.',
                  selected.size
                )}
                <Button priority="link" onClick={() => setAllInQuerySelected(true)}>
                  {tct('Select all [count] alerts that match this search query.', {
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
