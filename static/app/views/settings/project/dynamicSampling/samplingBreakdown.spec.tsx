import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Project} from 'sentry/types';
import {SamplingBreakdown} from 'sentry/views/settings/project/dynamicSampling/samplingBreakdown';

export const samplingBreakdownTitle = 'Transaction Breakdown';

function getMockData({projects, access}: {access?: string[]; projects?: Project[]} = {}) {
  return initializeOrg({
    ...initializeOrg(),
    organization: {
      ...initializeOrg().organization,
      features: [
        'server-side-sampling',
        'server-side-sampling-ui',
        'dynamic-sampling-basic',
      ],
      access: access ?? initializeOrg().organization.access,
      projects,
    },
    projects,
  });
}

describe('Dynamic Sampling - SamplingBreakdown', function () {
  beforeEach(function () {
    ServerSideSamplingStore.reset();
  });

  it('renders empty', function () {
    const {organization} = getMockData();

    render(<SamplingBreakdown orgSlug={organization.slug} />);

    expect(screen.getByText(/This project made no/)).toBeInTheDocument();
  });

  it('renders project breakdown', function () {
    const {organization} = getMockData();
    const projectBreakdown =
      TestStubs.DynamicSamplingConfig().samplingDistribution.projectBreakdown;

    ProjectsStore.loadInitialData(
      projectBreakdown!.map(p => TestStubs.Project({id: p.projectId, slug: p.project}))
    );

    ServerSideSamplingStore.distributionRequestSuccess(
      TestStubs.DynamicSamplingConfig().samplingDistribution
    );

    render(<SamplingBreakdown orgSlug={organization.slug} />);

    expect(screen.getByText(samplingBreakdownTitle)).toBeInTheDocument();
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('89.88%')).toBeInTheDocument();
    expect(screen.getByText('sentry')).toBeInTheDocument();
    expect(screen.getByText('10.12%')).toBeInTheDocument();
  });
});
