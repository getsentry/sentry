import {Organization} from 'sentry-fixture/organization';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import ThresholdsList from 'sentry/views/releases/thresholdsList/';

describe('ReleaseThresholdsList', () => {
  const organization = Organization({
    slug: 'test-thresholds',
    features: ['releases-v2'],
  });

  const {router, routerContext} = initializeOrg({
    organization,
  });

  let mockThresholdFetch;

  beforeEach(() => {
    mockThresholdFetch = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/release-thresholds/`,
      method: 'GET',
      body: [],
    });
    PageFiltersStore.init();
  });

  afterEach(() => {
    PageFiltersStore.reset();
    MockApiClient.clearMockResponses();
  });

  it('redirects to releases if flag is not set', () => {
    const organization2 = Organization({
      slug: 'test-thresholds-no-flag',
      features: [],
    });

    const {router: flaglessRouter, routerContext: flaglessRouterContext} = initializeOrg({
      organization: organization2,
    });
    const expectedRedirect = normalizeUrl(
      `/organizations/${organization2.slug}/releases/`
    );
    render(<ThresholdsList />, {
      context: flaglessRouterContext,
      organization: organization2,
    });

    expect(flaglessRouter.replace).toHaveBeenCalledTimes(1);
    expect(flaglessRouter.replace).toHaveBeenCalledWith(expectedRedirect);
  });

  it('fetches release thresholds for selected projects', async () => {
    const query = {
      project: [-1],
    };
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '1d', utc: null},
      },
      new Set()
    );
    routerContext.context.location.pathname = normalizeUrl(
      `/organizations/${organization.slug}/release-thresholds/`
    );
    render(<ThresholdsList />, {
      context: routerContext,
      organization,
    });
    expect(await screen.findByText('Thresholds')).toBeInTheDocument();
    expect(mockThresholdFetch).toHaveBeenCalledWith(
      '/organizations/test-thresholds/release-thresholds/',
      expect.objectContaining({query})
    );
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('filters fetch based on projects/environments selected', async () => {
    const expectedQuery = {
      project: [1, 2, 3],
      environment: ['foo'],
    };
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [1, 2, 3],
        environments: ['foo'],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set()
    );
    routerContext.context.location.pathname = normalizeUrl(
      `/organizations/${organization.slug}/release-thresholds/`
    );
    render(<ThresholdsList />, {context: routerContext, organization});
    expect(await screen.findByText('Thresholds')).toBeInTheDocument();
    expect(mockThresholdFetch).toHaveBeenCalledWith(
      '/organizations/test-thresholds/release-thresholds/',
      expect.objectContaining({query: expectedQuery})
    );
  });
});
