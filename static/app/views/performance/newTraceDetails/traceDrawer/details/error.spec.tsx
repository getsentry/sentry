import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import ProjectsStore from 'sentry/stores/projectsStore';
import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {ErrorNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/errorNode';
import {makeTraceError} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {ErrorNodeDetails} from './error';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('ErrorNodeDetails', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('renders error details with title and ID', () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({id: '1', slug: 'project_slug'});

    act(() => ProjectsStore.loadInitialData([project]));

    const errorValue = makeTraceError({
      event_id: 'test-error-id',
      title: 'TypeError: Cannot read property of undefined',
      level: 'error',
      message: 'Something went wrong',
    });

    const extra = createMockExtra({organization});
    const node = new ErrorNode(null, errorValue, extra);

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <ErrorNodeDetails
          node={node as any}
          organization={organization}
          onTabScrollToNode={jest.fn()}
          onParentClick={jest.fn()}
          manager={null}
          replay={null}
          traceId="test-trace-id"
          tree={null as any}
        />
      </TraceStateProvider>
    );

    expect(screen.getByText('Error')).toBeInTheDocument();

    expect(screen.getByText(/ID: test-error-id/)).toBeInTheDocument();

    expect(
      screen.getByText(/This error is related to an ongoing issue/)
    ).toBeInTheDocument();
  });
});
