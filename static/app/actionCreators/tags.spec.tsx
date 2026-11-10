import {useQuery} from '@tanstack/react-query';
import {TagsFixture} from 'sentry-fixture/tags';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {toast} from '@sentry/scraps/toast';

import {TagStore} from 'sentry/stores/tagStore';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';

import {loadOrganizationTags, organizationTagsApiOptions} from './tags';

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

describe('organizationTagsApiOptions', () => {
  it('fetches tags with the selected project, dataset, and date range', async () => {
    const tags = TagsFixture();
    const request = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: tags,
    });

    const {result} = renderHookWithProviders(() =>
      useQuery(
        organizationTagsApiOptions({
          orgSlug: 'org-slug',
          projectIds: ['1'],
          dataset: Dataset.ERRORS,
          start: '2026-01-01T00:00:00',
          end: '2026-01-02T00:00:00',
          useCache: false,
          useFlagsBackend: true,
        })
      )
    );

    await waitFor(() => expect(result.current.data).toEqual(tags));
    expect(request).toHaveBeenCalledWith(
      '/organizations/org-slug/tags/',
      expect.objectContaining({
        query: {
          project: ['1'],
          dataset: Dataset.ERRORS,
          start: '2026-01-01T00:00:00',
          end: '2026-01-02T00:00:00',
          useCache: '0',
          useFlagsBackend: '1',
        },
      })
    );
  });
});
