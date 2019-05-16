export function fetchOrganizationEvents(api, orgSlug, data) {
  return api.requestPromise(`/organizations/${orgSlug}/events/`, data);
}
