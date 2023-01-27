import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {CodecovStatusCode, Frame} from 'sentry/types';

import {CodecovLegend} from './codecovLegend';

describe('Frame - Codecov Legend', function () {
  const organization = TestStubs.Organization({
    features: ['codecov-stacktrace-integration'],
    codecovAccess: true,
  });
  const platform = 'python';
  const project = TestStubs.Project({});
  const event = TestStubs.Event({
    projectID: project.id,
    release: TestStubs.Release({lastCommit: TestStubs.Commit()}),
    platform,
  });
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({integrationId: integration.id});

  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;
  const config = TestStubs.RepositoryProjectPathConfig({project, repo, integration});

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  it('should render codecov legend', async function () {
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
        codecov: {status: CodecovStatusCode.COVERAGE_EXISTS},
      },
    });

    render(<CodecovLegend event={event} frame={frame} organization={organization} />, {
      context: TestStubs.routerContext(),
      organization,
      project,
    });

    expect(await screen.findByText('Covered')).toBeInTheDocument();
    expect(await screen.findByText('Uncovered')).toBeInTheDocument();
    expect(await screen.findByText('Partial')).toBeInTheDocument();
  });
});
