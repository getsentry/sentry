import {Tags} from 'sentry-fixture/tags';

import * as indicators from 'sentry/actionCreators/indicator';
import TagStore from 'sentry/stores/tagStore';

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
      body: Tags(),
    });
    expect(TagStore.getState().device).toBeUndefined();

    await loadOrganizationTags(api, 'org-slug', selection);

    expect(TagStore.getState().device).toBeTruthy();
  });

  it('should show an alert on failure', async () => {
    jest.spyOn(indicators, 'addErrorMessage');
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      statusCode: 403,
    });

    await loadOrganizationTags(api, 'org-slug', selection);
    expect(indicators.addErrorMessage).toHaveBeenCalledWith('Unable to load tags');
  });
});
