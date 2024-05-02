import type {Query} from 'history';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {t} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import TagStore from 'sentry/stores/tagStore';
import type {PageFilters} from 'sentry/types/core';
import type {Tag, TagValue} from 'sentry/types/group';

const MAX_TAGS = 1000;

function tagFetchSuccess(tags: Tag[] | undefined) {
  // We occasionally get undefined passed in when APIs are having a bad time.
  tags = tags || [];
  const trimmedTags = tags.slice(0, MAX_TAGS);

  if (tags.length > MAX_TAGS) {
    AlertStore.addAlert({
      message: t('You have too many unique tags and some have been truncated'),
      type: 'warning',
    });
  }
  TagStore.loadTagsSuccess(trimmedTags);
}

/**
 * Load an organization's tags based on a global selection value.
 */
export function loadOrganizationTags(
  api: Client,
  orgSlug: string,
  selection: PageFilters
): Promise<void> {
  TagStore.reset();

  const query: Query = selection.datetime
    ? {...normalizeDateTimeParams(selection.datetime)}
    : {};
  query.use_cache = '1';

  if (selection.projects) {
    query.project = selection.projects.map(String);
  }

  return api
    .requestPromise(`/organizations/${orgSlug}/tags/`, {
      method: 'GET',
      query,
    })
    .then(tagFetchSuccess)
    .catch(() => {
      addErrorMessage(t('Unable to load tags'));
    });
}

/**
 * Fetch tags for an organization or a subset or projects.
 */
export function fetchOrganizationTags(
  api: Client,
  orgId: string,
  projectIds: string[] | null = null
) {
  TagStore.reset();

  const url = `/organizations/${orgId}/tags/`;
  const query: Query = {use_cache: '1'};
  if (projectIds) {
    query.project = projectIds;
  }

  const promise = api.requestPromise(url, {
    method: 'GET',
    query,
  });

  promise.then(tagFetchSuccess);

  return promise;
}

/**
 * Fetch tag values for an organization.
 * The `projectIds` argument can be used to subset projects.
 */
export function fetchTagValues({
  api,
  orgSlug,
  tagKey,
  endpointParams,
  includeReplays,
  includeSessions,
  includeTransactions,
  projectIds,
  search,
  sort,
}: {
  api: Client;
  orgSlug: string;
  tagKey: string;
  endpointParams?: Query;
  includeReplays?: boolean;
  includeSessions?: boolean;
  includeTransactions?: boolean;
  projectIds?: string[];
  search?: string;
  sort?: string;
}): Promise<TagValue[]> {
  const url = `/organizations/${orgSlug}/tags/${tagKey}/values/`;

  const query: Query = {};
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

  if (includeTransactions) {
    query.includeTransactions = '1';
  }

  if (includeSessions) {
    query.includeSessions = '1';
  }

  if (includeReplays) {
    query.includeReplays = '1';
  }

  if (sort) {
    query.sort = sort;
  }

  return api.requestPromise(url, {
    method: 'GET',
    query,
  });
}

export function fetchSpanFieldValues({
  api,
  orgSlug,
  fieldKey,
  endpointParams,
  projectIds,
  search,
}: {
  api: Client;
  fieldKey: string;
  orgSlug: string;
  endpointParams?: Query;
  projectIds?: string[];
  search?: string;
}): Promise<TagValue[]> {
  const url = `/organizations/${orgSlug}/spans/fields/${fieldKey}/values/`;

  const query: Query = {};
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
