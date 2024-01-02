import {Event as EventFixture} from 'sentry-fixture/event';
import {Project as ProjectFixture} from 'sentry-fixture/project';
import {RouterContextFixture} from 'sentry-fixture/routerContextFixture';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {
  QuickTraceQueryChildrenProps,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import QuickTraceMeta from 'sentry/views/performance/transactionDetails/quickTraceMeta';

describe('QuickTraceMeta', function () {
  const routerContext = RouterContextFixture();
  const location = routerContext.context.location;
  const project = ProjectFixture({platform: 'javascript'});
  const event = EventFixture({contexts: {trace: {trace_id: 'a'.repeat(32)}}});
  const emptyQuickTrace: QuickTraceQueryChildrenProps = {
    isLoading: false,
    error: null,
    trace: [],
    type: 'empty',
    currentEvent: null,
  };
  const emptyTraceMeta: TraceMeta = {
    projects: 0,
    transactions: 0,
    errors: 0,
    performance_issues: 0,
  };

  it('renders basic UI', function () {
    render(
      <QuickTraceMeta
        event={event}
        project={project}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-body')).toBeInTheDocument();
  });

  it('renders placeholder while loading', function () {
    render(
      <QuickTraceMeta
        event={event}
        project={project}
        location={location}
        quickTrace={{
          ...emptyQuickTrace,
          isLoading: true,
        }}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    const qtBody = screen.getByTestId('quick-trace-body');
    expect(within(qtBody).getByTestId('loading-placeholder')).toBeInTheDocument();
  });

  it('renders errors', function () {
    render(
      <QuickTraceMeta
        event={event}
        project={project}
        location={location}
        quickTrace={{
          ...emptyQuickTrace,
          error: new QueryError('something bad'),
        }}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-body')).toHaveTextContent('\u2014');
  });

  it('renders footer', function () {
    render(
      <QuickTraceMeta
        event={event}
        project={project}
        location={location}
        quickTrace={{
          ...emptyQuickTrace,
          type: 'full',
          trace: [
            {
              event_id: '6c2fa0db524a41b784db2de220f9754c',
              span_id: '9f4d8db340e5b9c2',
              transaction: '/api/0/internal/health/',
              'transaction.duration': 15,
              project_id: 1,
              project_slug: 'sentry',
              parent_span_id: '87a45c44efdf60d5',
              parent_event_id: null,
              generation: 0,
              errors: [],
              performance_issues: [],
            },
          ],
        }}
        traceMeta={{
          projects: 0,
          transactions: 1,
          errors: 0,
          performance_issues: 0,
        }}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-body')).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-footer')).toHaveTextContent(
      `View Full Trace: ${'a'.repeat(8)} (1 event)`
    );
  });

  it('renders missing trace when trace id is not present', function () {
    const newEvent = EventFixture();
    render(
      <QuickTraceMeta
        event={newEvent}
        project={project}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-body')).toHaveTextContent('Missing Trace');
    expect(screen.getByTestId('quick-trace-footer')).toHaveTextContent('Read the docs');
  });

  it('renders missing trace with hover card when feature disabled', async function () {
    const newEvent = EventFixture();
    render(
      <QuickTraceMeta
        event={newEvent}
        project={project}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />,
      {context: routerContext}
    );

    expect(screen.getByRole('heading', {name: 'Trace Navigator'})).toBeInTheDocument();
    expect(screen.getByTestId('quick-trace-body')).toHaveTextContent('Missing Trace');
    const qtFooter = screen.getByTestId('quick-trace-footer');
    expect(qtFooter).toHaveTextContent('Read the docs');

    const child = qtFooter.firstChild;
    if (!child) {
      throw new Error('child is null');
    }
    await userEvent.hover(child as HTMLElement);
    expect(
      await screen.findByText('Requires performance monitoring.')
    ).toBeInTheDocument();
  });

  it('does not render when platform does not support tracing', function () {
    const newProject = ProjectFixture();
    const newEvent = EventFixture();
    const result = render(
      <QuickTraceMeta
        event={newEvent}
        project={newProject}
        location={location}
        quickTrace={emptyQuickTrace}
        traceMeta={emptyTraceMeta}
        anchor="left"
        errorDest="issue"
        transactionDest="performance"
      />
    );

    expect(result.container).toBeEmptyDOMElement();
  });
});
