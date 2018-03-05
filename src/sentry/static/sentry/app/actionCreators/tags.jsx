import {Client} from '../api';
import {t} from '../locale';
import TagStore from '../stores/tagStore';
import TagActions from '../actions/tagActions';
import AlertActions from '../actions/alertActions';

const api = new Client();

const MAX_TAGS = 500;

export function fetchTags(orgId, projectId) {
  TagStore.reset();
  TagActions.loadTags();

  api.request(`/projects/${orgId}/${projectId}/tags/`, {
    success: tags => {
      let trimmedTags = tags.slice(0, MAX_TAGS);

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
