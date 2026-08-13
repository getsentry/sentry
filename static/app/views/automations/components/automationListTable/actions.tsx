import {Fragment, useCallback} from 'react';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';

import {openConfirmModal} from 'sentry/components/confirm';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t, tct, tn} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {
  useDeleteAutomationsMutation,
  useUpdateAutomationsMutation,
} from 'sentry/views/automations/hooks';

interface AutomationsTableActionsProps {
  allInQuerySelected: boolean;
  canDisable: boolean;
  canEnable: boolean;
  pageSelected: boolean;
  queryCount: string;
  selected: Set<string>;
  setAllInQuerySelected: (allInQuerySelected: boolean) => void;
  togglePageSelected: (pageSelected: boolean) => void;
}

export function AutomationsTableActions({
  selected,
  pageSelected,
  togglePageSelected,
  queryCount,
  allInQuerySelected,
  setAllInQuerySelected,
  canEnable,
  canDisable,
}: AutomationsTableActionsProps) {
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
        'Are you sure you want to enable all [queryCount] alerts that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      'Are you sure you want to enable this %s alert?',
      'Are you sure you want to enable these %s alerts?',
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const getDisableConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to disable all [queryCount] alerts that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      'Are you sure you want to disable this %s alert?',
      'Are you sure you want to disable these %s alerts?',
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const handleUpdate = ({enabled}: {enabled: boolean}) => {
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
  };

  const getDeleteConfirmMessage = useCallback(() => {
    if (allInQuerySelected) {
      return tct(
        'Are you sure you want to delete all [queryCount] alerts that match the search?',
        {
          queryCount,
        }
      );
    }
    return tn(
      'Are you sure you want to delete this %s alert?',
      'Are you sure you want to delete these %s alerts?',
      selected.size
    );
  }, [allInQuerySelected, queryCount, selected.size]);

  const handleDelete = () => {
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
  };

  return (
    <SimpleTable.HeaderRow>
      <SimpleTable.HeaderCell variant="full-width" divider={false}>
        <Flex align="center" padding="0 xl" gap="md" width="100%">
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
          <Button size="xs" variant="danger" onClick={handleDelete} disabled={isDeleting}>
            {t('Delete')}
          </Button>
        </Flex>
      </SimpleTable.HeaderCell>
    </SimpleTable.HeaderRow>
  );
}

interface AutomationsTableActionsBannerProps {
  allInQuerySelected: boolean;
  allResultsVisible: boolean;
  pageSelected: boolean;
  queryCount: string;
  selected: Set<string>;
  setAllInQuerySelected: (allInQuerySelected: boolean) => void;
}

export function AutomationsTableActionsBanner({
  selected,
  pageSelected,
  allResultsVisible,
  queryCount,
  allInQuerySelected,
  setAllInQuerySelected,
}: AutomationsTableActionsBannerProps) {
  if (!pageSelected || allResultsVisible) {
    return null;
  }

  return (
    <SimpleTable.FullWidthRow>
      <Alert variant="warning" system showIcon={false}>
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
              <Button variant="link" onClick={() => setAllInQuerySelected(true)}>
                {tct('Select all [count] alerts that match this search query.', {
                  count: queryCount,
                })}
              </Button>
            </Fragment>
          )}
        </Flex>
      </Alert>
    </SimpleTable.FullWidthRow>
  );
}
