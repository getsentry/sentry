import {OrganizationFixture} from 'sentry-fixture/organization';
import {ThemeFixture} from 'sentry-fixture/theme';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ErrorNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/errorNode';
import {makeTraceError} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {TraceScheduler} from 'sentry/views/performance/traceDetails/traceRenderers/traceScheduler';
import {TraceView} from 'sentry/views/performance/traceDetails/traceRenderers/traceView';
import {VirtualizedViewManager} from 'sentry/views/performance/traceDetails/traceRenderers/virtualizedViewManager';
import {TraceErrorRow} from 'sentry/views/performance/traceDetails/traceRow/traceErrorRow';

describe('TraceErrorRow', () => {
  it('renders colored text without escape codes when the error title has ANSI codes', () => {
    const theme = ThemeFixture();
    const node = new ErrorNode(
      null,
      makeTraceError({title: '\x1B[31mfailed\x1B[0m to connect', timestamp: 1}),
      {organization: OrganizationFixture()}
    );
    const manager = new VirtualizedViewManager(
      {list: {width: 0.5}, span_list: {width: 0.5}},
      new TraceScheduler(),
      new TraceView(),
      theme
    );

    render(
      <TraceErrorRow
        index={0}
        listColumnClassName=""
        listColumnStyle={{}}
        manager={manager}
        node={node}
        onExpand={jest.fn()}
        onExpandDoubleClick={jest.fn()}
        onRowClick={jest.fn()}
        onRowDoubleClick={jest.fn()}
        onRowKeyDown={jest.fn()}
        onSpanArrowClick={jest.fn()}
        previouslyFocusedNodeRef={{current: null}}
        projects={{}}
        registerListColumnRef={jest.fn()}
        registerSpanArrowRef={jest.fn()}
        registerSpanColumnRef={jest.fn()}
        rowSearchClassName=""
        spanColumnClassName=""
        style={{}}
        tabIndex={-1}
        theme={theme}
        trace_id={undefined}
        virtualized_index={0}
      />
    );

    expect(screen.getByText('failed').style.color).toContain('color-mix(in srgb,');
    expect(screen.getByText('failed').closest('.TraceDescription')).toHaveTextContent(
      /^failed to connect$/
    );
  });
});
