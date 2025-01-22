import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Frame} from 'sentry/types/event';
import type {LineCoverage} from 'sentry/types/integrations';
import {CodecovStatusCode, Coverage} from 'sentry/types/integrations';

import Context, {getLineCoverage} from './context';

describe('Frame - Context', function () {
  const org = OrganizationFixture();
  const project = ProjectFixture();
  const event = EventFixture({projectID: project.id});
  const frame = {filename: '/sentry/app.py', lineNo: 233} as Frame;

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  const lines: [number, string][] = [
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

  it("doesn't query stacktrace coverage if the flag is off", function () {
    const mock = MockApiClient.addMockResponse({
      url: `/projects/${org.slug}/${project.slug}/stacktrace-coverage/`,
      body: {status: CodecovStatusCode.NO_COVERAGE_DATA},
    });
    render(<Context frame={frame} event={event} registers={{}} components={[]} />, {
      organization: org,
    });

    expect(mock).not.toHaveBeenCalled();
  });

  describe('syntax highlighting', function () {
    it('renders code correctly when context lines end in newline characters', function () {
      const organization = {
        ...org,
        codecovAccess: true,
      };
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/stacktrace-coverage/`,
        body: {status: CodecovStatusCode.NO_COVERAGE_DATA},
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
          registers={{}}
          components={[]}
        />,
        {organization}
      );

      expect(screen.getAllByTestId('context-line')).toHaveLength(3);

      expect(screen.getByText('this is line 1')).toBeInTheDocument();
      expect(screen.getByText('this is line 2')).toBeInTheDocument();
      expect(screen.getByText('this is line 3')).toBeInTheDocument();
    });
  });
});
