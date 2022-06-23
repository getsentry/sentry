import {Query} from 'history';

import {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import CustomMeasurementsStore from 'sentry/stores/customMeasurementsStore';
import {PageFilters} from 'sentry/types';

type CustomMeasurementMeta = {
  functions: string[];
};
export type CustomMeasurementMetaResponse = Record<string, CustomMeasurementMeta>;

function customMeasurementFetchSuccess(
  customMeasurements: CustomMeasurementMetaResponse | undefined
) {
  CustomMeasurementsStore.loadCustomMeasurementsSuccess(customMeasurements || {});
}

/**
 * Load an organization's custom measurements based on a global selection value.
 */
export function loadCustomMeasurements(
  api: Client,
  orgId: string,
  selection: PageFilters
) {
  CustomMeasurementsStore.reset();

  const url = `/organizations/${orgId}/measurements-meta/`;
  const query: Query = selection.datetime
    ? {...normalizeDateTimeParams(selection.datetime)}
    : {};

  if (selection.projects) {
    query.project = selection.projects.map(String);
  }
  const promise = api.requestPromise(url, {
    method: 'GET',
    query,
  });

  promise.then(customMeasurementFetchSuccess);

  return promise;
}
