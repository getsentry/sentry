import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, fireEvent, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import type {Field} from 'sentry/views/traces/data';
import {
  ProjectRenderer,
  ProjectsRenderer,
  SpanDescriptionRenderer,
  SpanIdRenderer,
  TraceIdRenderer,
  TraceIssuesRenderer,
  TransactionRenderer,
} from 'sentry/views/traces/fieldRenderers';
import type {SpanResult} from 'sentry/views/traces/hooks/useTraceSpans';

describe('Renderers', function () {
  let context: ReturnType<typeof initializeOrg>;

  const organization = OrganizationFixture({
    features: ['trace-view-v1'], // only testing against new trace view
  });

  const projects = [
    ProjectFixture({
      id: '1',
      slug: 'project-1',
      name: 'Project 1',
    }),
    ProjectFixture({
      id: '2',
      slug: 'project-2',
      name: 'Project 2',
    }),
    ProjectFixture({
      id: '3',
      slug: 'project-3',
      name: 'Project 3',
    }),
  ];

  function makeSpan(
    project: Project,
    span?: Partial<SpanResult<Field>>
  ): SpanResult<Field> {
    return {
      project: project.slug,
      'transaction.id': '00000000000000000000000000000000',
      id: '11111111111111111111111111111111',
      timestamp: '2024-07-03T10:15:00',
      'sdk.name': 'sentry.python',
      'span.op': 'op',
      'span.description': 'description',
      'span.duration': 123.456,
      'span.status': 'internal_error',
      'span.self_time': 12.34,
      'precise.start_ts': 1720015976.544,
      'precise.finish_ts': 1720016100.0,
      is_transaction: 1,
      ...span,
    };
  }

  beforeEach(function () {
    context = initializeOrg({organization, projects});
    act(() => ProjectsStore.loadInitialData(projects));

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: projects,
    });
  });

  describe('SpanDescriptionRenderer', function () {
    it('renders op then description', function () {
      const span = makeSpan(projects[0]!);

      render(<SpanDescriptionRenderer span={span} />);

      const description = screen.getByTestId('span-description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent('op\u2014descriptioninternal_error');
    });

    it.each(['unknown', 'foobar'])(
      'does not render span status %s',
      function (spanStatus) {
        const span = makeSpan(projects[0]!, {'span.status': spanStatus});

        render(<SpanDescriptionRenderer span={span} />);

        const description = screen.getByTestId('span-description');
        expect(description).toBeInTheDocument();
        expect(description).toHaveTextContent('op\u2014description');
      }
    );

    it.each(['ok', 'internal_error'])('renders span status %s', function (spanStatus) {
      const span = makeSpan(projects[0]!, {'span.status': spanStatus});

      render(<SpanDescriptionRenderer span={span} />);

      const description = screen.getByTestId('span-description');
      expect(description).toBeInTheDocument();
      expect(description).toHaveTextContent(`op\u2014description${spanStatus}`);
    });
  });

  describe('ProjectsRenderer', function () {
    it('renders one project', function () {
      render(<ProjectsRenderer projectSlugs={[projects[0]!.slug]} />, context);
      expect(screen.getAllByRole('img')).toHaveLength(1);
    });

    it('renders two projects', function () {
      render(
        <ProjectsRenderer projectSlugs={[projects[0]!.slug, projects[1]!.slug]} />,
        context
      );
      expect(screen.getAllByRole('img')).toHaveLength(2);
    });

    it('renders three projects', function () {
      render(<ProjectsRenderer projectSlugs={projects.map(p => p.slug)} />, context);
      expect(screen.getAllByRole('img')).toHaveLength(1);
      const collapsed = screen.getByTestId('collapsed-projects-badge');
      expect(collapsed).toBeInTheDocument();
      expect(collapsed).toHaveTextContent('+2');
    });
  });

  describe('ProjectRenderer', function () {
    it('renders project badge with name', function () {
      render(<ProjectRenderer projectSlug={projects[0]!.slug} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
      expect(screen.getByText(projects[0]!.slug)).toBeInTheDocument();
    });
  });

  describe('SpanIdRenderer', function () {
    it('renders span id with link', function () {
      const onClickHandler = jest.fn();

      const traceId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
      const span = makeSpan(projects[0]!);

      render(
        <SpanIdRenderer
          projectSlug={span.project}
          spanId={span.id}
          timestamp={span.timestamp}
          traceId={traceId}
          transactionId={span['transaction.id']}
          onClick={onClickHandler}
        />,
        context
      );

      const link = screen.getByText('11111111');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/performance/trace/${traceId}/?eventId=${span['transaction.id']}&node=span-${span.id}&node=txn-${span['transaction.id']}&source=traces&statsPeriod=14d&timestamp=1720016100`
      );

      expect(onClickHandler).toHaveBeenCalledTimes(0);
      fireEvent.click(link);
      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('TraceIdRenderer', function () {
    it('renders trace id with link', function () {
      const onClickHandler = jest.fn();

      const traceId = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

      render(
        <TraceIdRenderer
          location={context.router.location}
          timestamp={1720016100000}
          traceId={traceId}
          onClick={onClickHandler}
        />,
        context
      );

      const link = screen.getByText('aaaaaaaa');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/performance/trace/${traceId}/?pageEnd&pageStart&source=traces&statsPeriod=14d&timestamp=1720016100`
      );

      expect(onClickHandler).toHaveBeenCalledTimes(0);
      fireEvent.click(link);
      expect(onClickHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe('TransactionRenderer', function () {
    it('renders transaction with link', function () {
      render(
        <TransactionRenderer projectSlug={projects[0]!.slug} transaction="foobar" />
      );

      const link = screen.getByText('foobar');
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute(
        'href',
        `/organizations/${organization.slug}/performance/summary/?project=${projects[0]!.id}&referrer=performance-transaction-summary&transaction=foobar&unselectedSeries=p100%28%29&unselectedSeries=avg%28%29`
      );
    });
  });

  describe('TraceIssuesRenderer', function () {
    it('renders 0 issues', function () {
      render(
        <TraceIssuesRenderer
          trace={{
            breakdowns: [],
            duration: 123456,
            start: 1720015976544,
            end: 1720016100000,
            matchingSpans: 1,
            name: 'trace root',
            numErrors: 0,
            numOccurrences: 0,
            numSpans: 2,
            project: projects[0]!.slug,
            slices: 40,
            trace: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          }}
        />,
        context
      );
      const link = screen.getByRole('button');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('\u2014');
      expect(link).toBeDisabled();
    });

    it('renders 99+ issues', function () {
      render(
        <TraceIssuesRenderer
          trace={{
            breakdowns: [],
            duration: 123456,
            start: 1720015976544,
            end: 1720016100000,
            matchingSpans: 1,
            name: 'trace root',
            numErrors: 50,
            numOccurrences: 50,
            numSpans: 2,
            project: projects[0]!.slug,
            slices: 40,
            trace: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          }}
        />,
        context
      );
      const link = screen.getByRole('button');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('99+');
      expect(link).toBeEnabled();
    });

    it('renders N issues', function () {
      render(
        <TraceIssuesRenderer
          trace={{
            breakdowns: [],
            duration: 123456,
            start: 1720015976544,
            end: 1720016100000,
            matchingSpans: 1,
            name: 'trace root',
            numErrors: 5,
            numOccurrences: 5,
            numSpans: 2,
            project: projects[0]!.slug,
            slices: 40,
            trace: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
          }}
        />,
        context
      );
      const link = screen.getByRole('button');
      expect(link).toBeInTheDocument();
      expect(link).toHaveTextContent('10');
      expect(link).toBeEnabled();
    });
  });
});
