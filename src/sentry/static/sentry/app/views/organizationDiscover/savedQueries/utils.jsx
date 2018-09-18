import {Client} from 'app/api';

export function fetchSavedQueries(organization) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/`;

  return api.requestPromise(endpoint, {
    method: 'GET',
  });
}

export function createQuery(organization, data) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/`;

  return api.requestPromise(endpoint, {
    method: 'POST',
    data,
  });
}

export function updateQuery(organization, id, data) {
  const api = new Client();
  const endpoint = `/organizations/${organization.slug}/discover/saved/${id}/`;

  return api.requestPromise(endpoint, {
    method: 'POST',
    data,
  });
}
