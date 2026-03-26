import type {ReactNode} from 'react';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {registerSeerContext} from './registerSeerContext';
import {SeerContextProvider, useSeerContext} from './seerContext';
import type {SeerContextSnapshot} from './seerContextTypes';

// ---------------------------------------------------------------------------
// Test helper: ContextCapture
//
// Renders nothing but stores a reference to the getSnapshot function.
// Since the context value is memoized (stable), this component only renders
// once. However, getSnapshot() always reads stateRef.current (fresh), so
// calling capturedRef.current() in waitFor gives live data.
// ---------------------------------------------------------------------------

function makeContextCapture() {
  const ref: {current: ((componentOnly?: boolean) => SeerContextSnapshot) | null} = {
    current: null,
  };

  function ContextCapture() {
    const {getSeerContext} = useSeerContext();
    ref.current = getSeerContext;
    return null;
  }

  function getSnapshot(componentOnly?: boolean): SeerContextSnapshot {
    if (!ref.current) throw new Error('ContextCapture not mounted');
    return ref.current(componentOnly);
  }

  return {ContextCapture, getSnapshot};
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

function DummyChart({label}: {label?: string}) {
  useSeerContext({label: label ?? 'chart'});
  return <div>{label ?? 'chart'}</div>;
}

function DummyWidget({title, children}: {children?: ReactNode; title?: string}) {
  useSeerContext({title: title ?? 'widget'});
  return (
    <div>
      {title ?? 'widget'}
      {children}
    </div>
  );
}

function DummyDashboard({name, children}: {children?: ReactNode; name?: string}) {
  useSeerContext({name: name ?? 'dashboard'});
  return (
    <div>
      {name ?? 'dashboard'}
      {children}
    </div>
  );
}

const ContextChart = registerSeerContext('chart', DummyChart as any);
const ContextWidget = registerSeerContext('widget', DummyWidget as any);
const ContextDashboard = registerSeerContext('dashboard', DummyDashboard as any);

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SeerContextProvider — empty state', () => {
  it('returns an empty snapshot when no nodes are registered', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    render(
      <SeerContextProvider>
        <ContextCapture />
      </SeerContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes).toEqual([]);
    });
  });
});

describe('registerSeerContext — nesting', () => {
  it('nests Chart inside Widget inside Dashboard in the snapshot', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    render(
      <SeerContextProvider>
        <ContextDashboard name="Backend Health">
          <ContextWidget title="Error Rate">
            <ContextChart label="p99" />
          </ContextWidget>
        </ContextDashboard>
        <ContextCapture />
      </SeerContextProvider>
    );

    // Wait for the cascade of registration effects to settle
    await waitFor(() => {
      const snapshot = getSnapshot();

      expect(snapshot.nodes).toHaveLength(1);

      const [dashboard] = snapshot.nodes;
      expect(dashboard.nodeType).toBe('dashboard');
      expect(dashboard.data).toEqual({name: 'Backend Health'});
      expect(dashboard.children).toHaveLength(1);

      const [widget] = dashboard.children;
      expect(widget.nodeType).toBe('widget');
      expect(widget.data).toEqual({title: 'Error Rate'});
      expect(widget.children).toHaveLength(1);

      const [chart] = widget.children;
      expect(chart.nodeType).toBe('chart');
      expect(chart.data).toEqual({label: 'p99'});
    });
  });
});

describe('registerSeerContext — unmount cleanup', () => {
  it('removes the node from the tree when the component unmounts', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    const {rerender} = render(
      <SeerContextProvider>
        <ContextWidget title="Removable" />
        <ContextCapture />
      </SeerContextProvider>
    );

    // Node should be present after mount
    await waitFor(() => {
      expect(getSnapshot().nodes).toHaveLength(1);
    });

    // Unmount the widget
    rerender(
      <SeerContextProvider>
        <ContextCapture />
      </SeerContextProvider>
    );

    // Node should be gone
    await waitFor(() => {
      expect(getSnapshot().nodes).toHaveLength(0);
    });
  });
});

describe('useSeerContext — data updates', () => {
  it('writes data into the node and updates it on re-render', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Counter({count}: {count: number}) {
      useSeerContext({count});
      return <div>{count}</div>;
    }
    const ContextCounter = registerSeerContext('counter', Counter as any);

    const {rerender} = render(
      <SeerContextProvider>
        <ContextCounter count={1} />
        <ContextCapture />
      </SeerContextProvider>
    );

    // Initial data written after HOC registers and inner component re-renders
    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data?.count).toBe(1);
    });

    // Update the prop
    rerender(
      <SeerContextProvider>
        <ContextCounter count={2} />
        <ContextCapture />
      </SeerContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data?.count).toBe(2);
    });
  });
});

describe('getSeerContext — full tree vs componentOnly', () => {
  it('getSeerContext() returns full tree including sibling branches', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Widget1() {
      useSeerContext({id: 'w1'});
      return <div>w1</div>;
    }
    function Widget2() {
      useSeerContext({id: 'w2'});
      return <div>w2</div>;
    }
    const CW1 = registerSeerContext('widget', Widget1 as any);
    const CW2 = registerSeerContext('widget', Widget2 as any);

    render(
      <SeerContextProvider>
        <CW1 />
        <CW2 />
        <ContextCapture />
      </SeerContextProvider>
    );

    await waitFor(() => {
      const snapshot = getSnapshot();
      expect(snapshot.nodes).toHaveLength(2);
      const types = snapshot.nodes.map(n => n.nodeType);
      expect(types).toEqual(['widget', 'widget']);
    });
  });

  it('getSeerContext(true) returns only the current component subtree', async () => {
    // We need a capture inside the dashboard to test componentOnly
    const innerRef: {
      current: ((c?: boolean) => SeerContextSnapshot) | null;
    } = {current: null};

    function DashboardWithCapture({name}: {name: string}) {
      useSeerContext({name});
      const {getSeerContext} = useSeerContext();
      innerRef.current = getSeerContext;
      return (
        <div>
          <ContextWidget title="inner-widget" />
        </div>
      );
    }
    const ContextDashboardWithCapture = registerSeerContext(
      'dashboard',
      DashboardWithCapture as any
    );

    function SiblingDashboard() {
      useSeerContext({name: 'sibling'});
      return <div>sibling</div>;
    }
    const ContextSiblingDashboard = registerSeerContext(
      'dashboard',
      SiblingDashboard as any
    );

    render(
      <SeerContextProvider>
        <ContextDashboardWithCapture name="main" />
        <ContextSiblingDashboard />
      </SeerContextProvider>
    );

    // componentOnly snapshot should contain only the dashboard + its inner widget,
    // not the sibling dashboard
    await waitFor(() => {
      if (!innerRef.current) throw new Error('not mounted');
      const snapshot = innerRef.current(true); // componentOnly
      expect(snapshot.nodes).toHaveLength(1);
      expect(snapshot.nodes[0].nodeType).toBe('dashboard');
      expect(snapshot.nodes[0].children).toHaveLength(1);
      expect(snapshot.nodes[0].children[0].nodeType).toBe('widget');
    });
  });
});

describe('registerSeerContext — no provider', () => {
  it('renders the wrapped component normally when there is no SeerContextProvider', () => {
    render(<ContextWidget title="No Provider" />);
    expect(screen.getByText('No Provider')).toBeInTheDocument();
  });
});
