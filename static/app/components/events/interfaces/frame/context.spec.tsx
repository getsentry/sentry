import {EventFixture} from 'sentry-fixture/event';
import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RepositoryFixture} from 'sentry-fixture/repository';
import {RepositoryProjectPathConfigFixture} from 'sentry-fixture/repositoryProjectPathConfig';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import {Coverage, Frame, LineCoverage} from 'sentry/types';

import Context, {getLineCoverage} from './context';

describe('Frame - Context', function () {
  const org = OrganizationFixture();
  const project = ProjectFixture({});
  const event = EventFixture({projectID: project.id});
  const integration = GitHubIntegrationFixture();
  const repo = RepositoryFixture({integrationId: integration.id});
  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;
  const config = RepositoryProjectPathConfigFixture({project, repo, integration});

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
        context: RouterContextFixture([{organization: org}]),
        organization: org,
      }
    );

    expect(mock).not.toHaveBeenCalled();
  });

  describe('syntax highlighting', function () {
    it('renders code correctly when context lines end in newline characters', function () {
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-link/`,
        body: {
          config,
          sourceUrl: null,
          integrations: [integration],
        },
      });

      const testFrame: Frame = {
        ...frame,
        lineNo: 2,
        context: [
          [1, 'this is line 1\n'],
          [2, 'this is line 2\n'],
          [3, 'this is line 3\n'],
        ],
      };

      render(
        <Context
          isExpanded
          hasContextSource
          frame={testFrame}
          event={event}
          organization={OrganizationFixture({
            features: ['issue-details-stacktrace-syntax-highlighting'],
          })}
          registers={{}}
          components={[]}
        />
      );

      expect(screen.getAllByTestId('context-line')).toHaveLength(3);

      expect(screen.getByText('this is line 1')).toBeInTheDocument();
      expect(screen.getByText('this is line 2')).toBeInTheDocument();
      expect(screen.getByText('this is line 3')).toBeInTheDocument();
    });
  });
});
