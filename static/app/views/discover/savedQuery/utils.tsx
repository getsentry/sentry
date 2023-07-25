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
import {Client} from 'sentry/api';
import {t} from 'sentry/locale';
import {NewQuery, Organization, SavedQuery} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {SaveQueryEventParameters} from 'sentry/utils/analytics/discoverAnalyticsEvents';
import EventView from 'sentry/utils/discover/eventView';
import {DisplayModes} from 'sentry/utils/discover/types';
import {DisplayType} from 'sentry/views/dashboards/types';

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
          (err && err.message) ||
          `Could not save a ${isNewQuery ? 'new' : 'existing'} query`,
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
        error: (err && err.message) || 'Failed to update a query',
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
        error: (err && err.message) || 'Failed to update a query name',
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
        error: (err && err.message) || 'Failed to delete query',
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
    case DisplayModes.BAR:
      return DisplayType.BAR;
    case DisplayModes.TOP5:
      return DisplayType.TOP_N;
    default:
      return DisplayType.LINE;
  }
}
