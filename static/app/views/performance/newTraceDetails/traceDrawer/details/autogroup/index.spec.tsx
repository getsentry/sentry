import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceTreeNodeExtra} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import {EapSpanNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/eapSpanNode';
import {SiblingAutogroupNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/siblingAutogroupNode';
import {
  makeEAPSpan,
  makeSiblingAutogroup,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/newTraceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {AutogroupNodeDetails} from './index';

const createMockExtra = (
  overrides: Partial<TraceTreeNodeExtra> = {}
): TraceTreeNodeExtra => ({
  organization: OrganizationFixture(),
  ...overrides,
});

describe('AutogroupNodeDetails', () => {
  it('renders autogroup details with title and description', () => {
    const organization = OrganizationFixture();
    const extra = createMockExtra({organization});
    const autogroupValue = makeSiblingAutogroup({
      span_id: 'test-span-id',
      autogrouped_by: {
        op: 'db.query',
        description: 'SELECT * FROM users',
      },
    });

    const childSpanValue = makeEAPSpan({event_id: 'child-span-1'});
    const childNode = new EapSpanNode(null, childSpanValue, extra);
    const node = new SiblingAutogroupNode(null, autogroupValue, extra);
    node.children = [childNode];

    render(
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <AutogroupNodeDetails
          node={node as any}
          organization={organization}
          onTabScrollToNode={jest.fn()}
          onParentClick={jest.fn()}
          manager={null}
          replay={null}
          traceId="test-trace-id"
        />
      </TraceStateProvider>
    );

    // Verify title is rendered
    expect(screen.getByText('Autogroup')).toBeInTheDocument();

    // Verify span ID subtitle is rendered
    expect(screen.getByText(/ID: test-span-id/)).toBeInTheDocument();

    // Verify explanation text is rendered
    expect(
      screen.getByText(/This block represents autogrouped spans/)
    ).toBeInTheDocument();

    // Verify criteria bullet points are rendered
    expect(
      screen.getByText('5 or more siblings with the same operation and description')
    ).toBeInTheDocument();
    expect(
      screen.getByText('2 or more descendants with the same operation')
    ).toBeInTheDocument();

    // Verify usage instruction is rendered
    expect(
      screen.getByText(/You can either open this autogroup using the chevron/)
    ).toBeInTheDocument();
  });
});
