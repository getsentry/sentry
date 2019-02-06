import {Client} from 'app/api';
import {t} from 'app/locale';
import TagStore from 'app/stores/tagStore';
import TagActions from 'app/actions/tagActions';
import AlertActions from 'app/actions/alertActions';

const MAX_TAGS = 500;

export function fetchTags(orgId, projectId = null) {
  TagStore.reset();
  TagActions.loadTags();
  const api = new Client();
  const url = projectId
    ? `/projects/${orgId}/${projectId}/tags/`
    : `/organizations/${orgId}/tags/`;

  api.request(url, {
    success: tags => {
      const trimmedTags = tags.slice(0, MAX_TAGS);

      if (tags.length > MAX_TAGS) {
        AlertActions.addAlert({
          message: t('You have too many unique tags and some have been truncated'),
          type: 'warn',
        });
      }
      TagActions.loadTagsSuccess(trimmedTags);
    },
    error: TagActions.loadTagsError,
  });
}

export function fetchTagValues(api, tagKey, orgId, projectId = null, query = null) {
  const url = projectId
    ? `/projects/${orgId}/${projectId}/tags/${tagKey}/values/`
    : `/organizations/${orgId}/tags/${tagKey}/values/`;

  if (query) {
    query = {query};
  }

  return api.requestPromise(url, {
    method: 'GET',
    query,
  });
}

export function fetchOrganizationTags(api, orgId) {
  return api.requestPromise(`/organizations/${orgId}/tags/`, {
    method: 'GET',
  });
}
