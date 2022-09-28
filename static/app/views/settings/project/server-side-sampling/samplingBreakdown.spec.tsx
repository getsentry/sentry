import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Organization, Project} from 'sentry/types';
import {SamplingDistribution} from 'sentry/types/sampling';
import {SamplingBreakdown} from 'sentry/views/settings/project/server-side-sampling/samplingBreakdown';
import * as useDistributionImport from 'sentry/views/settings/project/server-side-sampling/utils/useDistribution';

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

function renderMockRequests({
  organizationSlug,
}: {
  organizationSlug: Organization['slug'];
  projectSlug: Project['slug'];
  distributionRequestBody?: SamplingDistribution;
}) {
  const projects = MockApiClient.addMockResponse({
    url: `/organizations/${organizationSlug}/projects/`,
    method: 'GET',
    body: mockedProjects,
  });

  return {projects};
}

describe('Server-Side Sampling - SamplingBreakdown', function () {
  it('renders empty', async function () {
    const {organization, project} = getMockInitializeOrg();

    renderMockRequests({organizationSlug: organization.slug, projectSlug: project.slug});

    jest.spyOn(useDistributionImport, 'useDistribution').mockImplementation(() => ({
      loading: false,
      error: false,
      data: undefined,
    }));

    render(
      <ComponentProviders>
        <SamplingBreakdown
          organizationSlug={organization.slug}
          projectSlug={project.slug}
          hasAccess
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

    renderMockRequests({
      organizationSlug: organization.slug,
      projectSlug: project.slug,
      distributionRequestBody: mockedSamplingDistribution,
    });

    jest.spyOn(useDistributionImport, 'useDistribution').mockImplementation(() => ({
      loading: false,
      error: false,
      data: mockedSamplingDistribution,
    }));

    render(
      <ComponentProviders>
        <SamplingBreakdown
          organizationSlug={organization.slug}
          projectSlug={project.slug}
          hasAccess
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
