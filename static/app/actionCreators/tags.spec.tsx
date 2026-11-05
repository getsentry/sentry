import {TagsFixture} from 'sentry-fixture/tags';

import {toast} from '@sentry/scraps/toast';

import {TagStore} from 'sentry/stores/tagStore';

import {loadOrganizationTags} from './tags';

describe('loadOrganizationTags', () => {
  const api = new MockApiClient();
  const selection = {
    datetime: {
      end: new Date().toISOString(),
      period: null,
      start: new Date().toISOString(),
      utc: null,
    },
    environments: [],
    projects: [],
  };

  afterEach(() => {
    TagStore.reset();
    jest.resetAllMocks();
  });

  it('should load tags into the store', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: TagsFixture(),
    });
    expect(TagStore.getState().device).toBeUndefined();

    await loadOrganizationTags(api, 'org-slug', selection, jest.fn());

    expect(TagStore.getState().device).toBeTruthy();
  });

  it('should show an alert on failure', async () => {
    jest.spyOn(toast, 'error');
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      statusCode: 403,
    });

    await loadOrganizationTags(api, 'org-slug', selection, jest.fn());
    expect(toast.error).toHaveBeenCalledWith('Unable to load tags');
  });
});
