import {Client} from '../api';
import {t} from '../locale';
import StreamTagStore from '../stores/streamTagStore';
import StreamTagActions from '../actions/streamTagActions';
import AlertActions from '../actions/alertActions';

const api = new Client();

const MAX_TAGS = 500;

export function fetchStreamTags(orgId, projectId) {
  StreamTagStore.reset();
  StreamTagActions.loadTags();

  api.request(`/projects/${orgId}/${projectId}/tags/`, {
    success: tags => {
      let trimmedTags = tags.slice(0, MAX_TAGS);

      if (tags.length > MAX_TAGS) {
        AlertActions.addAlert({
          message: t('You have too many unique tags and some have been truncated'),
          type: 'warn',
        });
      }
      StreamTagActions.loadTagsSuccess(trimmedTags);
    },
    error: StreamTagActions.loadTagsError,
  });
}
