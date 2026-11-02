import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {TraceTreeNodeDetails} from 'sentry/views/performance/traceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {ErrorNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/errorNode';
import {ParentAutogroupNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/parentAutogroupNode';
import {
  makeEAPSpan,
  makeParentAutogroup,
  makeTraceError,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

// Mock every panel that nodeDetails imports, not just the ones under test. Any
// real panel left in gets loaded by the first test's lazy import, which is too
// slow on a cold CI cache for findBy to wait out.
jest.mock(
  'sentry/views/performance/traceDetails/traceDrawer/details/missingInstrumentation',
  () => ({MissingInstrumentationNodeDetails: () => null})
);
jest.mock('sentry/views/performance/traceDetails/traceDrawer/details/uptime', () => ({
  UptimeNodeDetails: () => null,
}));
jest.mock(
  'sentry/views/performance/traceDetails/traceDrawer/details/uptime/timing',
  () => ({
    UptimeTimingDetails: () => null,
  })
);
jest.mock('sentry/views/performance/traceDetails/traceDrawer/details/span', () => ({
  EAPSpanNodeDetails: () => <div>span details</div>,
}));
jest.mock(
  'sentry/views/performance/traceDetails/traceDrawer/details/span/aiSpanDetails',
  () => ({
    AiSpanDetails: () => <div>ai span details</div>,
  })
);
jest.mock('sentry/views/performance/traceDetails/traceDrawer/details/autogroup', () => ({
  AutogroupNodeDetails: () => <div>autogroup details</div>,
}));
jest.mock('sentry/views/performance/traceDetails/traceDrawer/details/error', () => ({
  ErrorNodeDetails: ({node}: {node: BaseNode}) => {
    if (node.id === 'broken') {
      throw new Error('details failed to render');
    }
    return <div>error details for {node.id}</div>;
  },
}));

const organization = OrganizationFixture();
const extra = {organization};

function renderDetails(node: BaseNode) {
  return (
    <TraceTreeNodeDetails
      node={node}
      onTabScrollToNode={jest.fn()}
      organization={organization}
      traceId="trace-id"
    />
  );
}

describe('TraceTreeNodeDetails', () => {
  it('renders the span panel for a span node', async () => {
    render(renderDetails(new EapSpanNode(null, makeEAPSpan(), extra)));

    expect(await screen.findByText('span details')).toBeInTheDocument();
  });

  it('renders the AI panel for an AI span node', async () => {
    const value = makeEAPSpan({
      additional_attributes: {'gen_ai.operation.type': 'ai_client'},
    });
    render(renderDetails(new EapSpanNode(null, value, extra)));

    expect(await screen.findByText('ai span details')).toBeInTheDocument();
  });

  it('renders the autogroup panel for an autogroup node', async () => {
    const head = new EapSpanNode(null, makeEAPSpan(), extra);
    const tail = new EapSpanNode(head, makeEAPSpan(), extra);
    render(
      renderDetails(
        new ParentAutogroupNode(null, makeParentAutogroup(), extra, head, tail)
      )
    );

    expect(await screen.findByText('autogroup details')).toBeInTheDocument();
  });

  it('shows the next node details after a previous node failed to render', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
    const brokenNode = new ErrorNode(null, makeTraceError({event_id: 'broken'}), extra);
    const workingNode = new ErrorNode(null, makeTraceError({event_id: 'working'}), extra);

    const {rerender} = render(renderDetails(brokenNode));
    expect(
      await screen.findByText('There was an error loading a component.')
    ).toBeInTheDocument();

    rerender(renderDetails(workingNode));
    expect(await screen.findByText('error details for working')).toBeInTheDocument();
  });
});
