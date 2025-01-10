import type {Location} from 'history';

import {
  deleteHomepageQuery,
  updateHomepageQuery,
} from 'sentry/actionCreators/discoverHomepageQueries';
import {
  createSavedQuery,
  deleteSavedQuery,
  updateSavedQuery,
} from 'sentry/actionCreators/discoverSavedQueries';
import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import type {NewQuery, Organization, SavedQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {SaveQueryEventParameters} from 'sentry/utils/analytics/discoverAnalyticsEvents';
import type EventView from 'sentry/utils/discover/eventView';
import {
  DiscoverDatasets,
  DisplayModes,
  SavedQueryDatasets,
} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {DisplayType} from 'sentry/views/dashboards/types';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {DATASET_PARAM} from 'sentry/views/discover/savedQuery/datasetSelectorTabs';

export function handleCreateQuery(
  api: Client,
  organization: Organization,
  eventView: EventView,
  yAxis: string[],
  // True if this is a brand new query being saved
  // False if this is a modification from a saved query
  isNewQuery: boolean = true
): Promise<SavedQuery> {
  const payload = eventView.toNewQuery();
  payload.yAxis = yAxis;

  trackAnalytics(getAnalyticsCreateEventKeyName(isNewQuery, 'request'), {
    organization,
    ...extractAnalyticsQueryFields(payload),
  });
  const promise = createSavedQuery(api, organization.slug, payload);

  promise
    .then((savedQuery: SavedQuery) => {
      addSuccessMessage(t('Query saved'));
      trackAnalytics(getAnalyticsCreateEventKeyName(isNewQuery, 'success'), {
        organization,
        ...extractAnalyticsQueryFields(payload),
      });

      return savedQuery;
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not saved'));
      trackAnalytics(getAnalyticsCreateEventKeyName(isNewQuery, 'failed'), {
        organization,
        ...extractAnalyticsQueryFields(payload),
        error:
          err?.message || `Could not save a ${isNewQuery ? 'new' : 'existing'} query`,
      });
    });

  return promise;
}

export function handleUpdateQuery(
  api: Client,
  organization: Organization,
  eventView: EventView,
  yAxis: string[]
): Promise<SavedQuery> {
  const payload = eventView.toNewQuery();
  payload.yAxis = yAxis;

  if (!eventView.name) {
    addErrorMessage(t('Please name your query'));
    return Promise.reject();
  }

  trackAnalytics('discover_v2.update_query_request', {
    organization,
    ...extractAnalyticsQueryFields(payload),
  });

  const promise = updateSavedQuery(api, organization.slug, payload);

  promise
    .then((savedQuery: SavedQuery) => {
      addSuccessMessage(t('Query updated'));

      trackAnalytics('discover_v2.update_query_success', {
        organization,
        ...extractAnalyticsQueryFields(payload),
      });
      // NOTE: there is no need to convert _saved into an EventView and push it
      //       to the browser history, since this.props.eventView already
      //       derives from location.

      return savedQuery;
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not updated'));

      trackAnalytics('discover_v2.update_query_failed', {
        organization,
        ...extractAnalyticsQueryFields(payload),
        error: err?.message || 'Failed to update a query',
      });
    });

  return promise;
}

/**
 * Essentially the same as handleUpdateQuery, but specifically for changing the
 * name of the query
 */
export function handleUpdateQueryName(
  api: Client,
  organization: Organization,
  eventView: EventView
) {
  const payload = eventView.toNewQuery();
  trackAnalytics('discover_v2.update_query_name_request', {
    organization,
    ...extractAnalyticsQueryFields(payload),
  });

  const promise = updateSavedQuery(api, organization.slug, payload);

  promise
    .then(_saved => {
      addSuccessMessage(t('Query name saved'));

      trackAnalytics('discover_v2.update_query_name_successs', {
        organization,
        ...extractAnalyticsQueryFields(payload),
      });
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query name not saved'));

      trackAnalytics('discover_v2.update_query_failed', {
        organization,
        ...extractAnalyticsQueryFields(payload),
        error: err?.message || 'Failed to update a query name',
      });
    });

  return promise;
}

export function handleDeleteQuery(
  api: Client,
  organization: Organization,
  eventView: EventView
): Promise<void> {
  trackAnalytics('discover_v2.delete_query_request', {
    organization,
    ...extractAnalyticsQueryFields(eventView.toNewQuery()),
  });

  const promise = deleteSavedQuery(api, organization.slug, eventView.id!);

  promise
    .then(() => {
      addSuccessMessage(t('Query deleted'));
      trackAnalytics('discover_v2.delete_query_success', {
        organization,
        ...extractAnalyticsQueryFields(eventView.toNewQuery()),
      });
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not deleted'));
      trackAnalytics('discover_v2.delete_query_failed', {
        organization,
        ...extractAnalyticsQueryFields(eventView.toNewQuery()),
        error: err?.message || 'Failed to delete query',
      });
    });

  return promise;
}

export function handleUpdateHomepageQuery(
  api: Client,
  organization: Organization,
  query: NewQuery
) {
  const promise = updateHomepageQuery(api, organization.slug, query);

  return promise
    .then(savedQuery => {
      addSuccessMessage(t('Saved as Discover default'));
      return savedQuery;
    })
    .catch(() => {
      addErrorMessage(t('Unable to set query as Discover default'));
    });
}

export function handleResetHomepageQuery(api: Client, organization: Organization) {
  const promise = deleteHomepageQuery(api, organization.slug);

  return promise
    .then(() => {
      addSuccessMessage(t('Successfully removed Discover default'));
    })
    .catch(() => {
      addErrorMessage(t('Unable to remove Discover default'));
    });
}

export function getAnalyticsCreateEventKeyName(
  // True if this is a brand new query being saved
  // False if this is a modification from a saved query
  isNewQuery: boolean,
  type: 'request' | 'success' | 'failed'
): keyof SaveQueryEventParameters {
  return (
    isNewQuery
      ? 'discover_v2.save_new_query_' + type
      : 'discover_v2.save_existing_query_' + type
  ) as keyof SaveQueryEventParameters;
}

/**
 * Takes in a DiscoverV2 NewQuery object and returns a Partial containing
 * the desired fields to populate into reload analytics
 */
export function extractAnalyticsQueryFields(payload: NewQuery): Partial<NewQuery> {
  const {projects, fields, query} = payload;
  return {
    projects,
    fields,
    query,
  };
}

export function displayModeToDisplayType(displayMode: DisplayModes): DisplayType {
  switch (displayMode) {
    case DisplayModes.DAILYTOP5:
    case DisplayModes.DAILY:
    case DisplayModes.BAR:
      return DisplayType.BAR;
    case DisplayModes.TOP5:
      return DisplayType.TOP_N;
    case DisplayModes.PREVIOUS:
    case DisplayModes.DEFAULT:
      return DisplayType.AREA;
    default:
      return DisplayType.LINE;
  }
}

export function getSavedQueryDataset(
  organization: Organization,
  location: Location | undefined,
  savedQuery: SavedQuery | NewQuery | undefined,
  splitDecision?: SavedQueryDatasets
): SavedQueryDatasets {
  const dataset = decodeScalar(location?.query?.[DATASET_PARAM]);
  if (dataset) {
    return dataset as SavedQueryDatasets;
  }
  if (savedQuery?.queryDataset === SavedQueryDatasets.DISCOVER && splitDecision) {
    return splitDecision;
  }
  if (
    savedQuery?.queryDataset &&
    savedQuery?.queryDataset !== SavedQueryDatasets.DISCOVER
  ) {
    return savedQuery.queryDataset;
  }
  if (hasDatasetSelector(organization)) {
    return SavedQueryDatasets.ERRORS;
  }
  return SavedQueryDatasets.DISCOVER;
}

export function getSavedQueryWithDataset(
  savedQuery?: SavedQuery | NewQuery
): SavedQuery | NewQuery | undefined {
  if (!savedQuery) {
    return undefined;
  }
  return {
    ...savedQuery,
    dataset: getDatasetFromLocationOrSavedQueryDataset(
      undefined,
      savedQuery?.queryDataset
    ),
  };
}

export function getDatasetFromLocationOrSavedQueryDataset(
  location: Location | undefined,
  queryDataset: SavedQueryDatasets | undefined
): DiscoverDatasets | undefined {
  const dataset = decodeScalar(location?.query?.dataset);
  if (dataset) {
    return dataset as DiscoverDatasets;
  }
  const savedQueryDataset = decodeScalar(location?.query?.queryDataset) ?? queryDataset;
  switch (savedQueryDataset) {
    case SavedQueryDatasets.ERRORS:
      return DiscoverDatasets.ERRORS;
    case SavedQueryDatasets.TRANSACTIONS:
      return DiscoverDatasets.TRANSACTIONS;
    case SavedQueryDatasets.DISCOVER:
      return DiscoverDatasets.DISCOVER;
    default:
      return undefined;
  }
}

export function getSavedQueryDatasetFromLocationOrDataset(
  location: Location | undefined,
  dataset: DiscoverDatasets | undefined
): SavedQueryDatasets | undefined {
  const savedQueryDataset = decodeScalar(location?.query?.queryDataset);
  if (savedQueryDataset) {
    return savedQueryDataset as SavedQueryDatasets;
  }
  const discoverDataset = decodeScalar(location?.query?.dataset) ?? dataset;
  switch (discoverDataset) {
    case DiscoverDatasets.ERRORS:
      return SavedQueryDatasets.ERRORS;
    case DiscoverDatasets.TRANSACTIONS:
      return SavedQueryDatasets.TRANSACTIONS;
    case DiscoverDatasets.DISCOVER:
      return SavedQueryDatasets.DISCOVER;
    default:
      return undefined;
  }
}
