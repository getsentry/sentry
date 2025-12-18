import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {TraceViewDrawer} from 'sentry/views/insights/pages/agents/components/drawer';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const mockSetTraceDrawerQueryState = jest.fn();
let mockQueryState = {
  traceId: 'trace-123',
  spanId: null,
  timestamp: 1700,
};

const nodeFixture = (id: string): AITraceSpanNode =>
  ({
    id,
    parent_span_id: null,
    timestamp: 0,
    duration: 0,
    event_id: id,
    description: id,
    op: 'gen.ai',
    status: undefined,
    trace_id: 'trace-123',
    renderDetails: () => <div data-test-id={`details-${id}`}>details-{id}</div>,
    children: [],
    componentProps: {
      title: id,
      duration: 0,
    },
  } as unknown as AITraceSpanNode);

const mockNodes = [nodeFixture('span-1'), nodeFixture('span-2')];

jest.mock('sentry/views/insights/pages/agents/utils/urlParams', () => {
  const actual = jest.requireActual(
    'sentry/views/insights/pages/agents/utils/urlParams'
  );
  return {
    ...actual,
    useTraceDrawerQueryState: () => [mockQueryState, mockSetTraceDrawerQueryState],
  };
});

jest.mock('sentry/views/insights/pages/agents/hooks/useAITrace', () => ({
  useAITrace: () => ({
    nodes: mockNodes,
    isLoading: false,
    error: false,
  }),
}));

jest.mock('sentry/views/insights/pages/agents/components/aiSpanList', () => ({
  AISpanList: ({nodes, onSelectNode}: any) => (
    <div>
      {nodes.map(node => (
        <button key={node.id} onClick={() => onSelectNode(node)}>
          select-{node.id}
        </button>
      ))}
    </div>
  ),
}));

jest.mock('sentry/views/insights/pages/agents/hooks/useNodeDetailsLink', () => ({
  useNodeDetailsLink: () => '/trace-details',
}));

jest.mock('sentry/views/performance/newTraceDetails/traceState/traceStateProvider', () => ({
  TraceStateProvider: ({children}: {children: React.ReactNode}) => <>{children}</>,
}));

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

describe('TraceViewDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockQueryState = {
      traceId: 'trace-123',
      spanId: null,
      timestamp: 1700,
    };
  });

  it('preserves trace metadata when selecting a new span', async () => {
    render(
      <TraceViewDrawer traceSlug="trace-abc" timestamp={1850} closeDrawer={jest.fn()} />,
      {organization: OrganizationFixture()}
    );

    await userEvent.click(screen.getByRole('button', {name: 'select-span-2'}));

    expect(mockSetTraceDrawerQueryState).toHaveBeenCalledWith({
      traceId: 'trace-abc',
      spanId: 'span-2',
      timestamp: 1850,
    });
  });

  it('falls back to null timestamp when not provided', async () => {
    render(<TraceViewDrawer traceSlug="trace-xyz" closeDrawer={jest.fn()} />, {
      organization: OrganizationFixture(),
    });

    await userEvent.click(screen.getByRole('button', {name: 'select-span-1'}));

    expect(mockSetTraceDrawerQueryState).toHaveBeenCalledWith({
      traceId: 'trace-xyz',
      spanId: 'span-1',
      timestamp: null,
    });
  });
});
