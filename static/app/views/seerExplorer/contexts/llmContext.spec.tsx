import type {ReactNode} from 'react';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {LLMContextProvider, useLLMContext} from './llmContext';
import type {LLMContextSnapshot} from './llmContextTypes';
import {registerLLMContext} from './registerLLMContext';

/**
 * Test helper: ContextCapture
 *
 * Renders nothing but stores a reference to the getSnapshot function.
 * Since the context value is memoized (stable), this component only renders
 * once. However, getSnapshot() always reads stateRef.current (fresh), so
 * calling capturedRef.current() in waitFor gives live data.
 */
function makeContextCapture() {
  const ref: {current: ((componentOnly?: boolean) => LLMContextSnapshot) | null} = {
    current: null,
  };

  function ContextCapture() {
    const {getLLMContext} = useLLMContext();
    ref.current = getLLMContext;
    return null;
  }

  function getSnapshot(componentOnly?: boolean): LLMContextSnapshot {
    if (!ref.current) throw new Error('ContextCapture not mounted');
    return ref.current(componentOnly);
  }

  return {ContextCapture, getSnapshot};
}

// Test fixtures

function DummyChart({label}: {label?: string}) {
  useLLMContext({label: label ?? 'chart'});
  return <div>{label ?? 'chart'}</div>;
}

function DummyWidget({title, children}: {children?: ReactNode; title?: string}) {
  useLLMContext({title: title ?? 'widget', type: 'timeseries', unit: 'ms'});
  return (
    <div>
      {title ?? 'widget'}
      {children}
    </div>
  );
}

function DummyDashboard({name, children}: {children?: ReactNode; name?: string}) {
  useLLMContext({name: name ?? 'dashboard'});
  return (
    <div>
      {name ?? 'dashboard'}
      {children}
    </div>
  );
}

const ContextChart = registerLLMContext('chart', DummyChart);
const ContextWidget = registerLLMContext('widget', DummyWidget);
const ContextDashboard = registerLLMContext('dashboard', DummyDashboard);

describe('LLMContextProvider — empty state', () => {
  it('returns an empty snapshot when no nodes are registered', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    render(
      <LLMContextProvider>
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes).toEqual([]);
    });
  });
});

describe('registerLLMContext — nesting', () => {
  it('nests Chart inside Widget inside Dashboard in the snapshot', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    render(
      <LLMContextProvider>
        <ContextDashboard name="Backend Health">
          <ContextWidget title="Error Rate">
            <ContextChart label="p99" />
          </ContextWidget>
        </ContextDashboard>
        <ContextCapture />
      </LLMContextProvider>
    );

    // Wait for the cascade of registration effects to settle, then assert the
    // entire nested shape in one pass so the failure message shows the full tree.
    await waitFor(() => {
      expect(getSnapshot()).toEqual({
        version: expect.any(Number),
        nodes: [
          {
            nodeType: 'dashboard',
            data: {name: 'Backend Health'},
            children: [
              {
                nodeType: 'widget',
                data: {title: 'Error Rate', type: 'timeseries', unit: 'ms'},
                children: [
                  {
                    nodeType: 'chart',
                    data: {label: 'p99'},
                    children: [],
                  },
                ],
              },
            ],
          },
        ],
      });
    });
  });
});

describe('registerLLMContext — unmount cleanup', () => {
  it('removes the node from the tree when the component unmounts', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    const {rerender} = render(
      <LLMContextProvider>
        <ContextWidget title="Removable" />
        <ContextCapture />
      </LLMContextProvider>
    );

    // Node should be present after mount
    await waitFor(() => {
      expect(getSnapshot().nodes).toHaveLength(1);
    });

    // Unmount the widget
    rerender(
      <LLMContextProvider>
        <ContextCapture />
      </LLMContextProvider>
    );

    // Node should be gone
    await waitFor(() => {
      expect(getSnapshot().nodes).toHaveLength(0);
    });
  });
});

describe('useLLMContext — data updates', () => {
  it('writes data into the node and updates it on re-render', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Gauge({value}: {value: number}) {
      useLLMContext({value});
      return <div>{value}</div>;
    }
    const ContextGauge = registerLLMContext('widget', Gauge);

    const {rerender} = render(
      <LLMContextProvider>
        <ContextGauge value={1} />
        <ContextCapture />
      </LLMContextProvider>
    );

    // Initial data written after HOC registers and inner component re-renders
    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data).toEqual({value: 1});
    });

    // Update the prop
    rerender(
      <LLMContextProvider>
        <ContextGauge value={2} />
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data).toEqual({value: 2});
    });
  });

  it('handles non-object data types', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Label({text}: {text: string}) {
      useLLMContext(text);
      return <div>{text}</div>;
    }
    const ContextLabel = registerLLMContext('widget', Label);

    render(
      <LLMContextProvider>
        <ContextLabel text="hello" />
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data).toBe('hello');
    });
  });

  it('handles array data', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Tags({items}: {items: string[]}) {
      useLLMContext(items);
      return <div>{items.join(',')}</div>;
    }
    const ContextTags = registerLLMContext('widget', Tags);

    render(
      <LLMContextProvider>
        <ContextTags items={['a', 'b', 'c']} />
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data).toEqual(['a', 'b', 'c']);
    });
  });

  it('handles numeric data', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Score({value}: {value: number}) {
      useLLMContext(value);
      return <div>{value}</div>;
    }
    const ContextScore = registerLLMContext('widget', Score);

    render(
      <LLMContextProvider>
        <ContextScore value={42} />
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(getSnapshot().nodes[0]?.data).toBe(42);
    });
  });
});

describe('getLLMContext — full tree vs componentOnly', () => {
  it('getLLMContext() returns full tree including sibling branches', async () => {
    const {ContextCapture, getSnapshot} = makeContextCapture();

    function Widget1() {
      useLLMContext({id: 'w1'});
      return <div>w1</div>;
    }
    function Widget2() {
      useLLMContext({id: 'w2'});
      return <div>w2</div>;
    }
    const CW1 = registerLLMContext('widget', Widget1);
    const CW2 = registerLLMContext('widget', Widget2);

    render(
      <LLMContextProvider>
        <CW1 />
        <CW2 />
        <ContextCapture />
      </LLMContextProvider>
    );

    await waitFor(() => {
      const snapshot = getSnapshot();
      expect(snapshot.nodes).toHaveLength(2);
      const types = snapshot.nodes.map(n => n.nodeType);
      expect(types).toEqual(['widget', 'widget']);
    });
  });

  it('getLLMContext(true) returns only the current component subtree', async () => {
    // We need a capture inside the dashboard to test componentOnly
    const innerRef: {
      current: ((c?: boolean) => LLMContextSnapshot) | null;
    } = {current: null};

    function DashboardWithCapture({name}: {name: string}) {
      useLLMContext({name});
      const {getLLMContext} = useLLMContext();
      innerRef.current = getLLMContext;
      return (
        <div>
          <ContextWidget title="inner-widget" />
        </div>
      );
    }
    const ContextDashboardWithCapture = registerLLMContext(
      'dashboard',
      DashboardWithCapture
    );

    function SiblingDashboard() {
      useLLMContext({name: 'sibling'});
      return <div>sibling</div>;
    }
    const ContextSiblingDashboard = registerLLMContext('dashboard', SiblingDashboard);

    render(
      <LLMContextProvider>
        <ContextDashboardWithCapture name="main" />
        <ContextSiblingDashboard />
      </LLMContextProvider>
    );

    // componentOnly snapshot should contain only the dashboard + its inner widget,
    // not the sibling dashboard
    await waitFor(() => {
      if (!innerRef.current) throw new Error('not mounted');
      const snapshot = innerRef.current(true); // componentOnly
      expect(snapshot.nodes).toHaveLength(1);
      expect(snapshot.nodes[0]?.nodeType).toBe('dashboard');
      expect(snapshot.nodes[0]?.children).toHaveLength(1);
      expect(snapshot.nodes[0]?.children[0]?.nodeType).toBe('widget');
    });
  });
});
