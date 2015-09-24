import api from "../api";
import StreamTagActions from "../actions/streamTagActions";

export function fetchTags(params) {
  StreamTagActions.loadTags();

  return api.request(`/projects/${params.orgId}/${params.projectId}/tags/`, {
    success: StreamTagActions.loadTagsSuccess,
    error: StreamTagActions.loadTagsError
  });
}

export function fetchTagValues(params, tagKey, query, onSuccess) {
  StreamTagActions.loadTagValues();
  return api.request(`/projects/${params.orgId}/${params.projectId}/tags/${tagKey}/values/`, {
    data: {
      query: query
    },
    method: "GET",
    success: (values) => {
      StreamTagActions.loadTagValuesSuccess(tagKey, values.map(v => '"' + v.value + '"'));
      onSuccess && onSuccess(values);
    },
    error: StreamTagActions.loadTagValuesError
  });
}