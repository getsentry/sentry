import {useMemo} from 'react';
import * as Sentry from '@sentry/react';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {openSaveQueryModal} from 'sentry/actionCreators/modal';
import {t} from 'sentry/locale';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {getIdFromLocation} from 'sentry/views/explore/contexts/pageParamsContext/id';
import {useGetSavedQuery} from 'sentry/views/explore/hooks/useGetSavedQueries';
import {useSaveMetricsMultiQuery} from 'sentry/views/explore/metrics/hooks/useSaveMetricsMultiQuery';
import {TraceItemDataset} from 'sentry/views/explore/types';

import {canUseMetricsSavedQueriesUI} from './metricsFlags';

interface UseSaveAsMetricItemsOptions {
  interval: string;
}

export function useSaveAsMetricItems(_options: UseSaveAsMetricItemsOptions) {
  const location = useLocation();
  const organization = useOrganization();
  const {saveQuery, updateQuery} = useSaveMetricsMultiQuery();
  const id = getIdFromLocation(location);
  const {data: savedQuery} = useGetSavedQuery(id);

  const saveAsItems = useMemo(() => {
    if (!canUseMetricsSavedQueriesUI(organization)) {
      return [];
    }

    const items = [];

    if (defined(id) && savedQuery?.isPrebuilt === false) {
      items.push({
        key: 'update-query',
        textValue: t('Existing Query'),
        label: <span>{t('Existing Query')}</span>,
        onAction: async () => {
          try {
            addLoadingMessage(t('Updating query...'));
            await updateQuery();
            addSuccessMessage(t('Query updated successfully'));
            trackAnalytics('metrics.save_as', {
              save_type: 'update_query',
              ui_source: 'searchbar',
              organization,
            });
          } catch (error) {
            addErrorMessage(t('Failed to update query'));
            Sentry.captureException(error);
          }
        },
      });
    }

    items.push({
      key: 'save-query',
      label: <span>{t('A New Query')}</span>,
      textValue: t('A New Query'),
      onAction: () => {
        trackAnalytics('metrics.save_query_modal', {
          action: 'open',
          save_type: 'save_new_query',
          ui_source: 'table',
          organization,
        });
        openSaveQueryModal({
          organization,
          saveQuery,
          source: 'table',
          traceItemDataset: TraceItemDataset.TRACEMETRICS,
        });
      },
    });

    return items;
  }, [id, savedQuery?.isPrebuilt, updateQuery, saveQuery, organization]);

  // TODO: Implement alert functionality when organizations:tracemetrics-alerts flag is enabled

  // TODO: Implement dashboard functionality when organizations:tracemetrics-dashboards flag is enabled

  return useMemo(() => {
    return saveAsItems;
  }, [saveAsItems]);
}
