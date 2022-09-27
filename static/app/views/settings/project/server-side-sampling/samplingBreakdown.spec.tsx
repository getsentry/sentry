import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SamplingBreakdown} from 'sentry/views/settings/project/server-side-sampling/samplingBreakdown';

import {
  getMockInitializeOrg,
  mockedProjects,
  mockedSamplingDistribution,
} from './testUtils';

export const samplingBreakdownTitle = 'Transaction Breakdown';

function ComponentProviders({children}: {children: React.ReactNode}) {
  const client = new QueryClient();
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('Server-Side Sampling - SamplingBreakdown', function () {
  it('renders empty', async function () {
    const {organization, project} = getMockInitializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/dynamic-sampling/distribution/`,
      method: 'GET',
      body: {},
    });

    render(
      <ComponentProviders>
        <SamplingBreakdown
          organizationSlug={organization.slug}
          projectSlug={project.slug}
        />
      </ComponentProviders>
    );

    expect(
      await screen.findByText(
        'There were no traces initiated from this project in the last 30 days.'
      )
    ).toBeInTheDocument();
  });

  it('renders project breakdown', async function () {
    const {organization, project} = getMockInitializeOrg();

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/dynamic-sampling/distribution/`,
      method: 'GET',
      body: mockedSamplingDistribution,
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: mockedProjects,
    });

    render(
      <ComponentProviders>
        <SamplingBreakdown
          organizationSlug={organization.slug}
          projectSlug={project.slug}
        />
      </ComponentProviders>
    );

    expect(screen.getByText(samplingBreakdownTitle)).toBeInTheDocument();
    expect(await screen.findByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('89.88%')).toBeInTheDocument();
    expect(screen.getByText('sentry')).toBeInTheDocument();
    expect(screen.getByText('10.12%')).toBeInTheDocument();
  });
});
