import {Client} from 'app/api';
import {t} from 'app/locale';
import {Organization, NewQuery, SavedQuery} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {
  createSavedQuery,
  deleteSavedQuery,
  updateSavedQuery,
} from 'app/actionCreators/discoverSavedQueries';
import {addSuccessMessage, addErrorMessage} from 'app/actionCreators/indicator';
import EventView from 'app/utils/discover/eventView';

export function handleCreateQuery(
  api: Client,
  organization: Organization,
  eventView: EventView,
  // True if this is a brand new query being saved
  // False if this is a modification from a saved query
  isNewQuery: boolean = true
): Promise<SavedQuery> {
  const payload = eventView.toNewQuery();

  trackAnalyticsEvent({
    ...getAnalyticsCreateEventKeyName(isNewQuery, 'request'),
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload),
  });

  const promise = createSavedQuery(api, organization.slug, payload);

  promise
    .then((savedQuery: SavedQuery) => {
      addSuccessMessage(t('Query saved'));

      trackAnalyticsEvent({
        ...getAnalyticsCreateEventKeyName(isNewQuery, 'success'),
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(payload),
      });

      return savedQuery;
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not saved'));

      trackAnalyticsEvent({
        ...getAnalyticsCreateEventKeyName(isNewQuery, 'failed'),
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(payload),
        error:
          (err && err.message) ||
          `Could not save a ${isNewQuery ? 'new' : 'existing'} query`,
      });
    });

  return promise;
}

const EVENT_NAME_EXISTING_MAP = {
  request: 'Discoverv2: Request to save a saved query as a new query',
  success: 'Discoverv2: Successfully saved a saved query as a new query',
  failed: 'Discoverv2: Failed to save a saved query as a new query',
};
const EVENT_NAME_NEW_MAP = {
  request: 'Discoverv2: Request to save a new query',
  success: 'Discoverv2: Successfully saved a new query',
  failed: 'Discoverv2: Failed to save a new query',
};

export function handleUpdateQuery(
  api: Client,
  organization: Organization,
  eventView: EventView
): Promise<SavedQuery> {
  const payload = eventView.toNewQuery();

  if (!eventView.name) {
    addErrorMessage(t('Please name your query'));
    return Promise.reject();
  }

  trackAnalyticsEvent({
    eventKey: 'discover_v2.update_query_request',
    eventName: 'Discoverv2: Request to update a saved query',
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload),
  });

  const promise = updateSavedQuery(api, organization.slug, payload);

  promise
    .then((savedQuery: SavedQuery) => {
      addSuccessMessage(t('Query updated'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_query_success',
        eventName: 'Discoverv2: Successfully updated a saved query',
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(payload),
      });
      // NOTE: there is no need to convert _saved into an EventView and push it
      //       to the browser history, since this.props.eventView already
      //       derives from location.

      return savedQuery;
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not updated'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_query_failed',
        eventName: 'Discoverv2: Failed to update a saved query',
        organization_id: parseInt(organization.id, 10),
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

  trackAnalyticsEvent({
    eventKey: 'discover_v2.update_query_name_request',
    eventName: "Discoverv2: Request to update a saved query's name",
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(payload),
  });

  const promise = updateSavedQuery(api, organization.slug, payload);

  promise
    .then(_saved => {
      addSuccessMessage(t('Query name saved'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_query_name_success',
        eventName: "Discoverv2: Successfully updated a saved query's name",
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(payload),
      });
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query name not saved'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.update_query_failed',
        eventName: "Discoverv2: Failed to update a saved query's name",
        organization_id: parseInt(organization.id, 10),
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
  trackAnalyticsEvent({
    eventKey: 'discover_v2.delete_query_request',
    eventName: 'Discoverv2: Request to delete a saved query',
    organization_id: parseInt(organization.id, 10),
    ...extractAnalyticsQueryFields(eventView.toNewQuery()),
  });

  const promise = deleteSavedQuery(api, organization.slug, eventView.id!);

  promise
    .then(() => {
      addSuccessMessage(t('Query deleted'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.delete_query_success',
        eventName: 'Discoverv2: Successfully deleted a saved query',
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(eventView.toNewQuery()),
      });
    })
    .catch((err: Error) => {
      addErrorMessage(t('Query not deleted'));

      trackAnalyticsEvent({
        eventKey: 'discover_v2.delete_query_failed',
        eventName: 'Discoverv2: Failed to delete a saved query',
        organization_id: parseInt(organization.id, 10),
        ...extractAnalyticsQueryFields(eventView.toNewQuery()),
        error: (err && err.message) || 'Failed to delete query',
      });
    });

  return promise;
}

export function getAnalyticsCreateEventKeyName(
  // True if this is a brand new query being saved
  // False if this is a modification from a saved query
  isNewQuery: boolean,
  type: 'request' | 'success' | 'failed'
) {
  const eventKey = isNewQuery
    ? 'discover_v2.save_new_query_' + type
    : 'discover_v2.save_existing_query_' + type;

  const eventName = isNewQuery ? EVENT_NAME_NEW_MAP[type] : EVENT_NAME_EXISTING_MAP[type];

  return {
    eventKey,
    eventName,
  };
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
