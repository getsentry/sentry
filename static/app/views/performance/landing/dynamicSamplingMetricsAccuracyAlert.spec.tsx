import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  DynamicSamplingMetricsAccuracyAlert,
  dynamicSamplingMetricsAccuracyMessage,
} from './dynamicSamplingMetricsAccuracyAlert';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Dynamic Sampling Alert', function () {
  it('does not render if requirements are not met', function () {
    const {organization, project} = initializeOrg();

    const statsV2Mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: TestStubs.Outcomes(),
    });

    const {rerender} = render(
      <ComponentProviders>
        <DynamicSamplingMetricsAccuracyAlert
          organization={organization}
          selectedProject={project}
        />
      </ComponentProviders>
    );

    expect(
      screen.queryByText(dynamicSamplingMetricsAccuracyMessage)
    ).not.toBeInTheDocument(); // required feature flags are not enabled

    rerender(
      <ComponentProviders>
        <DynamicSamplingMetricsAccuracyAlert
          organization={{
            ...organization,
            features: [
              'server-side-sampling',
              'server-side-sampling-ui',
              'dynamic-sampling-performance-cta',
            ],
          }}
          selectedProject={undefined}
        />
      </ComponentProviders>
    );

    expect(
      screen.queryByText(dynamicSamplingMetricsAccuracyMessage)
    ).not.toBeInTheDocument(); // project is undefined

    rerender(
      <ComponentProviders>
        <DynamicSamplingMetricsAccuracyAlert
          organization={{
            ...organization,
            features: [
              'server-side-sampling',
              'server-side-sampling-ui',
              'dynamic-sampling-performance-cta',
            ],
            access: [],
          }}
          selectedProject={project}
        />
      </ComponentProviders>
    );

    expect(
      screen.queryByText(dynamicSamplingMetricsAccuracyMessage)
    ).not.toBeInTheDocument(); // user does not have project:write access

    expect(statsV2Mock).not.toHaveBeenCalled();
  });

  it('renders if requirements are  met', async function () {
    const {organization, project} = initializeOrg();

    const statsV2Mock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/stats_v2/`,
      method: 'GET',
      body: TestStubs.OutcomesWithLowProcessedEvents(),
    });

    render(
      <ComponentProviders>
        <DynamicSamplingMetricsAccuracyAlert
          organization={{
            ...organization,
            features: [
              'server-side-sampling',
              'server-side-sampling-ui',
              'dynamic-sampling-performance-cta',
            ],
          }}
          selectedProject={project}
        />
      </ComponentProviders>
    );

    expect(
      await screen.findByText(dynamicSamplingMetricsAccuracyMessage)
    ).toBeInTheDocument();

    expect(statsV2Mock).toHaveBeenCalledTimes(1);
  });
});
