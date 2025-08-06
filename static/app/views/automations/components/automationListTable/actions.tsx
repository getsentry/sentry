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

  const getConfirmMessage = useCallback(
    (action: string) => {
      if (allInQuerySelected) {
        return tct(
          'Are you sure you want to [action] all [queryCount] automations that match the search?',
          {
            action,
            queryCount,
          }
        );
      }
      return tn(
        // Use sprintf argument swapping since the number value must come
        // first. See https://github.com/alexei/sprintf.js#argument-swapping
        `Are you sure you want to %2$s this %s automation?`,
        `Are you sure you want to %2$s these %s automations?`,
        selected.size,
        action
      );
    },
    [allInQuerySelected, queryCount, selected.size]
  );

  const handleUpdate = useCallback(
    ({enabled}: {enabled: boolean}) => {
      openConfirmModal({
        message: getConfirmMessage(enabled ? t('enable') : t('disable')),
        confirmText: enabled ? t('Enable') : t('Disable'),
        priority: 'danger',
        onConfirm: () => {
          if (allInQuerySelected) {
            updateAutomations({enabled, query, projects: selection.projects});
          } else {
            updateAutomations({enabled, ids: Array.from(selected)});
          }
          togglePageSelected(false);
        },
      });
    },
    [
      selected,
      allInQuerySelected,
      updateAutomations,
      getConfirmMessage,
      togglePageSelected,
      selection.projects,
      query,
    ]
  );

  const handleDelete = useCallback(() => {
    openConfirmModal({
      message: getConfirmMessage(t('delete')),
      confirmText: t('Delete'),
      priority: 'danger',
      onConfirm: () => {
        if (allInQuerySelected) {
          deleteAutomations({query, projects: selection.projects});
        } else {
          deleteAutomations({ids: Array.from(selected)});
        }
        togglePageSelected(false);
      },
    });
  }, [
    selected,
    allInQuerySelected,
    deleteAutomations,
    getConfirmMessage,
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
        <FullWidthAlert type="warning" showIcon={false}>
          <Flex justify="center" wrap="wrap" gap="md">
            {allInQuerySelected ? (
              tct('Selected all [count] automations that match this search query.', {
                count: queryCount,
              })
            ) : (
              <Fragment>
                {tn(
                  '%s automation on this page selected.',
                  '%s automations on this page selected.',
                  selected.size
                )}
                <a onClick={() => setAllInQuerySelected(true)}>
                  {tct('Select all [count] automations that match this search query.', {
                    count: queryCount,
                  })}
                </a>
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
