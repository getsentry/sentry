import {createPortal} from 'react-dom';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Layer, useLayerContext, usePortalContainer} from '@sentry/scraps/layer';

function LayerInfo({testId}: {testId: string}) {
  const {variant, depth} = useLayerContext();
  return (
    <div data-test-id={testId}>
      {variant ?? 'none'}:{depth}
    </div>
  );
}

function PortaledContent({children}: {children: React.ReactNode}) {
  const portalOutlet = usePortalContainer();
  if (!portalOutlet) {
    return null;
  }
  return createPortal(
    <div style={{pointerEvents: 'auto'}}>{children}</div>,
    portalOutlet
  );
}

describe('Layer', () => {
  it('renders children', () => {
    render(
      <Layer variant="content">
        <span>hello</span>
      </Layer>
    );
    expect(screen.getByText('hello')).toBeInTheDocument();
  });

  it('provides variant and depth via context', () => {
    render(
      <Layer variant="nav">
        <LayerInfo testId="info" />
      </Layer>
    );
    expect(screen.getByTestId('info')).toHaveTextContent('nav:0');
  });

  it('increments depth when nesting same variant', () => {
    render(
      <Layer variant="overlay">
        <LayerInfo testId="outer" />
        <Layer variant="overlay">
          <LayerInfo testId="inner" />
          <Layer variant="overlay">
            <LayerInfo testId="deepest" />
          </Layer>
        </Layer>
      </Layer>
    );
    expect(screen.getByTestId('outer')).toHaveTextContent('overlay:0');
    expect(screen.getByTestId('inner')).toHaveTextContent('overlay:1');
    expect(screen.getByTestId('deepest')).toHaveTextContent('overlay:2');
  });

  it('resets depth when variant changes', () => {
    render(
      <Layer variant="content">
        <LayerInfo testId="content" />
        <Layer variant="overlay">
          <LayerInfo testId="overlay" />
        </Layer>
      </Layer>
    );
    expect(screen.getByTestId('content')).toHaveTextContent('content:0');
    expect(screen.getByTestId('overlay')).toHaveTextContent('overlay:0');
  });

  it('renders a wrapping div for the stacking context', () => {
    render(
      <Layer variant="content">
        <span>styled</span>
      </Layer>
    );
    const layerDiv = screen.getByText('styled').parentElement!;
    expect(layerDiv.tagName).toBe('DIV');
  });

  it('creates a portal outlet element', () => {
    render(
      <Layer variant="content">
        <PortaledContent>portaled text</PortaledContent>
      </Layer>
    );
    expect(screen.getByText('portaled text')).toBeInTheDocument();
  });

  it('contains portaled content within the layer DOM', () => {
    render(
      <Layer variant="content">
        <span data-test-id="sibling">sibling</span>
        <PortaledContent>portaled text</PortaledContent>
      </Layer>
    );
    const layerDiv = screen.getByTestId('sibling').parentElement!;
    expect(layerDiv).toContainElement(screen.getByText('portaled text'));
  });

  it('provides separate portal outlets for nested layers', () => {
    const outlets: Record<string, HTMLElement | null> = {};

    function CaptureOutlet({name}: {name: string}) {
      const outlet = usePortalContainer();
      outlets[name] = outlet;
      return null;
    }

    render(
      <Layer variant="content">
        <CaptureOutlet name="content" />
        <Layer variant="overlay">
          <CaptureOutlet name="overlay" />
        </Layer>
      </Layer>
    );

    expect(outlets.content).not.toBeNull();
    expect(outlets.overlay).not.toBeNull();
    expect(outlets.content).not.toBe(outlets.overlay);
  });

  it('returns null from usePortalContainer when outside a Layer', () => {
    function Check() {
      const container = usePortalContainer();
      return <span>{container === null ? 'null' : 'exists'}</span>;
    }
    render(<Check />);
    expect(screen.getByText('null')).toBeInTheDocument();
  });

  it('returns default context from useLayerContext when outside a Layer', () => {
    render(<LayerInfo testId="outside" />);
    expect(screen.getByTestId('outside')).toHaveTextContent('none:0');
  });
});
