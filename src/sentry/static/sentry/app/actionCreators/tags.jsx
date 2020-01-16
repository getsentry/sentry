import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {t} from 'app/locale';
import TagStore from 'app/stores/tagStore';
import TagActions from 'app/actions/tagActions';
import AlertActions from 'app/actions/alertActions';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';

const MAX_TAGS = 1000;

const BUILTIN_TAGS = [
  'event.type',
  'platform',
  'message',
  'title',
  'location',
  'timestamp',
  'release',
  'user.id',
  'user.username',
  'user.email',
  'user.ip',
  'sdk.name',
  'sdk.version',
  'contexts.key',
  'contexts.value',
  'http.method',
  'http.url',
  'os.build',
  'os.kernel_version',
  'device.brand',
  'device.locale',
  'device.uuid',
  'device.model_id',
  'device.arch',
  'device.orientation',
  'geo.country_code',
  'geo.region',
  'geo.city',
  'error.type',
  'error.value',
  'error.mechanism',
  'error.handled',
  'stack.abs_path',
  'stack.filename',
  'stack.package',
  'stack.module',
  'stack.function',
  'stack.stack_level',
].map(tag => ({
  key: tag,
}));

function tagFetchSuccess(tags) {
  const trimmedTags = tags.slice(0, MAX_TAGS);

  if (tags.length > MAX_TAGS) {
    AlertActions.addAlert({
      message: t('You have too many unique tags and some have been truncated'),
      type: 'warn',
    });
  }
  TagActions.loadTagsSuccess(trimmedTags);
}

function normalizeSelection(selection) {
  if (!selection) {
    return selection;
  }

  selection = pick(selection, ['projects', 'datetime']);

  if (selection.datetime) {
    selection.datetime = getParams(selection.datetime);
  }

  return selection;
}

export function loadOrganizationTags(api, orgId, selection) {
  selection = normalizeSelection(selection);

  if (isEqual(normalizeSelection(TagStore.getSelectionOnLatestFetch()), selection)) {
    const tags = Object.keys(TagStore.getAllTags()).map(key => {
      return {
        key,
      };
    });

    return Promise.resolve(tags);
  }

  TagStore.reset();

  const url = `/organizations/${orgId}/tags/`;

  const query = selection.datetime ? {...getParams(selection.datetime)} : {};

  if (selection.projects) {
    query.project = selection.projects;
  }

  // NOTE: Organization tags do not depend on environments, since environments
  //       themselves are also tags. Hence, we do not pass the list of environments
  //       as part of the query payload.

  TagStore.setSelectionOnLatestFetch(selection);

  const promise = api
    .requestPromise(url, {
      method: 'GET',
      query,
    })
    .then(tags => {
      return [...BUILTIN_TAGS, ...tags];
    });

  promise.then(
    results => {
      tagFetchSuccess(results);
    },
    reason => {
      TagActions.loadTagsError(reason);
    }
  );

  return promise;
}

/**
 * Fetch tags for an organization or a subset or projects.
 */
export function fetchOrganizationTags(api, orgId, projectIds = null) {
  TagStore.reset();
  TagActions.loadTags();

  const url = `/organizations/${orgId}/tags/`;
  const query = projectIds ? {project: projectIds, use_cache: 1} : null;

  const promise = api
    .requestPromise(url, {
      method: 'GET',
      query,
    })
    .then(tags => {
      return [...BUILTIN_TAGS, ...tags];
    });
  promise.then(tagFetchSuccess, TagActions.loadTagsError);

  return promise;
}

/**
 * Fetch tag values for an organization.
 * The `projectIds` argument can be used to subset projects.
 */
export function fetchTagValues(
  api,
  orgId,
  tagKey,
  search = null,
  projectIds = null,
  endpointParams = null
) {
  const url = `/organizations/${orgId}/tags/${tagKey}/values/`;

  const query = {};
  if (search) {
    query.query = search;
  }
  if (projectIds) {
    query.project = projectIds;
  }
  if (endpointParams) {
    if (endpointParams.start) {
      query.start = endpointParams.start;
    }
    if (endpointParams.end) {
      query.end = endpointParams.end;
    }
    if (endpointParams.statsPeriod) {
      query.statsPeriod = endpointParams.statsPeriod;
    }
  }

  return api.requestPromise(url, {
    method: 'GET',
    query,
  });
}
