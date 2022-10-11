import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {SamplingBreakdown} from 'sentry/views/settings/project/server-side-sampling/samplingBreakdown';

import {getMockData, mockedSamplingDistribution} from './testUtils';

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Server-Side Sampling - SamplingBreakdown', function () {
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
    const projectBreakdown = mockedSamplingDistribution.projectBreakdown;

    ProjectsStore.loadInitialData(
      projectBreakdown!.map(p => TestStubs.Project({id: p.projectId, slug: p.project}))
    );

    ServerSideSamplingStore.distributionRequestSuccess(mockedSamplingDistribution);

    render(<SamplingBreakdown orgSlug={organization.slug} />);

    expect(screen.getByText(samplingBreakdownTitle)).toBeInTheDocument();
    expect(screen.getByText('javascript')).toBeInTheDocument();
    expect(screen.getByText('89.88%')).toBeInTheDocument();
    expect(screen.getByText('sentry')).toBeInTheDocument();
    expect(screen.getByText('10.12%')).toBeInTheDocument();
  });
});
