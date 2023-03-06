import {render} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {Coverage, Frame, LineCoverage} from 'sentry/types';

import Context, {getLineCoverage} from './context';

describe('Frame - Context', function () {
  const org = TestStubs.Organization();
  const project = TestStubs.Project({});
  const event = TestStubs.Event({projectID: project.id});
  const integration = TestStubs.GitHubIntegration();
  const repo = TestStubs.Repository({integrationId: integration.id});
  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;
  const config = TestStubs.RepositoryProjectPathConfig({project, repo, integration});

  beforeEach(function () {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  const lines: Array<[number, string]> = [
    [231, 'this is line 231'],
    [232, 'this is line 232'],
    [233, 'this is line 233'],
    [234, 'this is line 234'],
  ];

  const lineCoverage: LineCoverage[] = [
    [230, Coverage.PARTIAL],
    [231, Coverage.PARTIAL],
    [232, Coverage.COVERED],
    [234, Coverage.NOT_COVERED],
  ];

  it("gets coverage data for the frame's lines", function () {
    expect(getLineCoverage(lines, lineCoverage)).toEqual([
      [Coverage.PARTIAL, Coverage.COVERED, undefined, Coverage.NOT_COVERED],
      true,
    ]);
  });

  it("doesn't query stacktrace link if the flag is off", function () {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
      body: {
        config,
        sourceUrl: null,
        integrations: [integration],
      },
    });
    render(
      <Context
        frame={frame}
        event={event}
        organization={org}
        registers={{}}
        components={[]}
      />,
      {
        context: TestStubs.routerContext([{organization: org}]),
        organization: org,
        project,
      }
    );

    expect(mock).not.toHaveBeenCalled();
  });
});
