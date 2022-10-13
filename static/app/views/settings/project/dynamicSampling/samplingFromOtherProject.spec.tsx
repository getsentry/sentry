import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {ServerSideSamplingStore} from 'sentry/stores/serverSideSamplingStore';
import {Project} from 'sentry/types';

import {SamplingFromOtherProject} from './samplingFromOtherProject';

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

export const samplingBreakdownTitle = 'Transaction Breakdown';

describe('Dynamic Sampling - SamplingFromOtherProject', function () {
  beforeEach(function () {
    ProjectsStore.reset();
    ServerSideSamplingStore.reset();
  });

  it('renders the parent projects', function () {
    const {organization} = getMockData();
    const parentProjectBreakdown =
      TestStubs.DynamicSamplingConfig().samplingDistribution.parentProjectBreakdown;

    ProjectsStore.loadInitialData(
      parentProjectBreakdown!.map(p =>
        TestStubs.Project({id: p.projectId, slug: p.project})
      )
    );

    ServerSideSamplingStore.distributionRequestSuccess(
      TestStubs.DynamicSamplingConfig().samplingDistribution
    );

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
    const parentProjectBreakdown =
      TestStubs.DynamicSamplingConfig().samplingDistribution.parentProjectBreakdown;

    ProjectsStore.loadInitialData(
      parentProjectBreakdown!.map(p =>
        TestStubs.Project({id: p.projectId, slug: p.project})
      )
    );

    ServerSideSamplingStore.distributionRequestSuccess({
      ...TestStubs.DynamicSamplingConfig().samplingDistribution,
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
