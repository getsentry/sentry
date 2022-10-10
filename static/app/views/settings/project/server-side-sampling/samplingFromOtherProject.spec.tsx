import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';

import {SamplingFromOtherProject} from './samplingFromOtherProject';
import {getMockData, mockedSamplingDistribution} from './testUtils';

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Server-Side Sampling - SamplingFromOtherProject', function () {
  afterEach(function () {
    act(() => ProjectsStore.reset());
    act(() => ServerSideSamplingStore.reset());
  });

  it('renders the parent projects', function () {
    const {organization} = getMockData();
    const parentProjectBreakdown = mockedSamplingDistribution.parentProjectBreakdown;

    ProjectsStore.loadInitialData(
      parentProjectBreakdown!.map(p =>
        TestStubs.Project({id: p.projectId, slug: p.project})
      )
    );

    ServerSideSamplingStore.distributionRequestSuccess(mockedSamplingDistribution);

    render(<SamplingFromOtherProject orgSlug={organization.slug} projectSlug="abc" />);

    expect(screen.getByText('parent-project')).toBeInTheDocument();
    expect(
      screen.getByText(
        'The following project made sampling decisions for this project. You might want to set up rules there.'
      )
    ).toBeInTheDocument();
  });

  it('does not render if there are no parent projects', function () {
    const {organization} = getMockData();
    const parentProjectBreakdown = mockedSamplingDistribution.parentProjectBreakdown;

    ProjectsStore.loadInitialData(
      parentProjectBreakdown!.map(p =>
        TestStubs.Project({id: p.projectId, slug: p.project})
      )
    );

    ServerSideSamplingStore.distributionRequestSuccess({
      ...mockedSamplingDistribution,
      parentProjectBreakdown: [],
    });

    render(<SamplingFromOtherProject orgSlug={organization.slug} projectSlug="abc" />);

    expect(screen.queryByText('parent-project')).not.toBeInTheDocument();
    expect(
      screen.queryByText(
        'The following project made sampling decisions for this project. You might want to set up rules there.'
      )
    ).not.toBeInTheDocument();
  });
});
