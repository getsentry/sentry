import {initializeOrg} from 'sentry-test/initializeOrg';
import {makeTestQueryClient} from 'sentry-test/queryClient';
import {reactHooks} from 'sentry-test/reactTestingLibrary';

import {QueryClientProvider} from 'sentry/utils/queryClient';
import {
  AlertRuleTriggerType,
  type MetricRule,
} from 'sentry/views/alerts/rules/metric/types';
import {OrganizationContext} from 'sentry/views/organizationContext';

import useFetchThresholdsListData from './useFetchThresholdsListData';

describe('useFetchThresholdsListData', () => {
  const {organization} = initializeOrg({
    organization: {
      name: 'test-org',
      slug: 'test-thresholds',
      features: ['releases-v2'],
    },
  });

  const queryClient = makeTestQueryClient();

  const Wrapper = (org = organization) => {
    return function WrappedComponent({children}) {
      return (
        <QueryClientProvider client={queryClient}>
          <OrganizationContext.Provider value={org}>
            {children}
          </OrganizationContext.Provider>
        </QueryClientProvider>
      );
    };
  };

  const mockThresholdApis = (data = {}) => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/release-thresholds/`,
      method: 'GET',
      body: data,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/alert-rules/`,
      method: 'GET',
      body: data,
    });
  };

  afterEach(() => {
    queryClient.clear();
  });

  it('fetches release thresholds by default', async () => {
    const thresholds = [];
    mockThresholdApis(thresholds);

    const {result, waitFor} = reactHooks.renderHook(() => useFetchThresholdsListData(), {
      wrapper: Wrapper(),
    });

    // ensure the async fetch is working
    expect(result.current.isLoading).toBeTruthy();
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    expect(result.current.data).toEqual(thresholds);
  });

  it('fetches activated alerts if the feature is enabled', async () => {
    const alerts = [];
    mockThresholdApis(alerts);

    const {organization: org} = initializeOrg({
      organization: {
        name: 'test-org',
        slug: 'test-thresholds',
        features: ['activated-alert-rules'],
      },
    });

    const {result, waitFor} = reactHooks.renderHook(() => useFetchThresholdsListData(), {
      wrapper: Wrapper(org),
    });

    expect(result.current.isLoading).toBeTruthy();
    await waitFor(() => expect(result.current.isLoading).toBeFalsy());
    expect(result.current.data).toEqual(alerts);
  });

  it('formats actiavted alerts as thresholds', async () => {
    const alerts: Partial<MetricRule>[] = [
      {
        id: '1',
        dateCreated: '2021-01-01',
        environment: 'production',
        projects: ['test-project'],
        timeWindow: 60,
        triggers: [
          {
            label: AlertRuleTriggerType.CRITICAL,
            actions: [],
            alertThreshold: 100,
          },
        ],
      },
    ];

    mockThresholdApis(alerts);

    const {organization: org} = initializeOrg({
      organization: {
        name: 'test-org',
        slug: 'test-thresholds',
        features: ['activated-alert-rules'],
      },
    });

    const {result, waitFor} = reactHooks.renderHook(() => useFetchThresholdsListData(), {
      wrapper: Wrapper(org),
    });

    await waitFor(() => expect(result.current.isLoading).toBeFalsy());

    const expectedResult = [
      {
        date_added: '2021-01-01',
        environment: {
          name: 'production',
          displayName: 'production',
        },
        id: '1',
        project: {
          id: 'test-project',
          slug: 'test-project',
        },
        threshold_type: 'total_error_count',
        trigger_type: 'over',
        value: 100,
        window_in_seconds: 60,
      },
    ];

    expect(result.current.data).toEqual(expectedResult);
  });
});
