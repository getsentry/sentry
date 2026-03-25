import {render, screen} from 'sentry-test/reactTestingLibrary';

import {PageContextProvider, usePageContextProvider} from './pageContext';
import {registerPageContext} from './registerPageContext';

function SnapshotReader() {
  const ctx = usePageContextProvider();
  const snapshot = ctx?.getSnapshot();
  return <pre data-test-id="snapshot">{JSON.stringify(snapshot)}</pre>;
}

describe('PageContextProvider + getSnapshot', () => {
  it('returns an empty snapshot when no nodes are registered', () => {
    render(
      <PageContextProvider>
        <SnapshotReader />
      </PageContextProvider>
    );

    const snapshot = JSON.parse(screen.getByTestId('snapshot').textContent);
    expect(snapshot.nodes).toEqual([]);
    expect(snapshot.version).toBe(0);
  });
});

describe('registerPageContext HOC', () => {
  function DummyWidget(props: {title: string}) {
    return <div>{props.title}</div>;
  }

  const ContextAwareWidget = registerPageContext('widget', DummyWidget, {
    extract: props => ({title: props.title}),
  });

  it('registers a node on mount with extracted data', () => {
    render(
      <PageContextProvider>
        <ContextAwareWidget title="Error Rate" />
        <SnapshotReader />
      </PageContextProvider>
    );

    expect(screen.getByText('Error Rate')).toBeInTheDocument();
    const snapshot = JSON.parse(screen.getByTestId('snapshot').textContent);
    expect(snapshot.nodes).toHaveLength(1);
    expect(snapshot.nodes[0].nodeType).toBe('widget');
    expect(snapshot.nodes[0].data).toEqual({title: 'Error Rate'});
  });

  it('renders normally outside a provider', () => {
    render(<ContextAwareWidget title="No Provider" />);
    expect(screen.getByText('No Provider')).toBeInTheDocument();
  });
});
