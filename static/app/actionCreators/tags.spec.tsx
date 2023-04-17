import TagStore from 'sentry/stores/tagStore';

import {loadOrganizationTags} from './tags';

describe('loadOrganizationTags', () => {
  const api = new MockApiClient();
  afterEach(() => {
    TagStore.reset();
  });

  it('should load tags into the store', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: TestStubs.Tags(),
    });
    expect(TagStore.getState().device).toBeUndefined();

    await loadOrganizationTags(api, 'org-slug', {
      datetime: {
        end: new Date().toISOString(),
        period: null,
        start: new Date().toISOString(),
        utc: null,
      },
      environments: [],
      projects: [],
    });

    expect(TagStore.getState().device).toBeTruthy();
  });
});
