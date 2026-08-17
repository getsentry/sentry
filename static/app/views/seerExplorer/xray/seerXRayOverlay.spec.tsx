import {act} from 'react';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  LLMContextProvider,
  useLLMContext,
} from 'sentry/views/seerExplorer/contexts/llmContext';
import {registerLLMContext} from 'sentry/views/seerExplorer/contexts/registerLLMContext';

import {SeerXRayOverlay} from './seerXRayOverlay';
import {setXRayModeEnabled} from './xrayModeStore';

function DummyWidget({title}: {title: string}) {
  useLLMContext({title});
  return <div>{title}</div>;
}
const ContextWidget = registerLLMContext('widget', DummyWidget);

function rect(overrides: Partial<DOMRect> = {}): DOMRect {
  return {
    top: 10,
    left: 20,
    width: 100,
    height: 50,
    bottom: 60,
    right: 120,
    x: 20,
    y: 10,
    toJSON: () => ({}),
    ...overrides,
  };
}

describe('SeerXRayOverlay', () => {
  beforeEach(() => {
    // jsdom does no real layout and doesn't even implement
    // Range#getBoundingClientRect (which the overlay uses to measure each
    // `display: contents` node anchor). Stub it so registered nodes aren't
    // filtered out as "not visible".
    Range.prototype.getBoundingClientRect = jest.fn().mockReturnValue(rect());
    // The overlay repolls on a real setInterval; a leftover tick firing
    // between one test's assertions and the next test's cleanup produces a
    // stray, un-`act`-wrapped state update. `advanceTimers: true` keeps
    // timers ticking automatically without that race.
    jest.useFakeTimers({advanceTimers: true});
  });

  afterEach(() => {
    // RTL's own unmount-on-cleanup afterEach hasn't necessarily run yet, so
    // the just-finished test's SeerXRayOverlay may still be mounted here.
    act(() => setXRayModeEnabled(false));
    jest.useRealTimers();
  });

  it('renders nothing when XRay mode is disabled', () => {
    setXRayModeEnabled(false);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>
    );

    expect(screen.queryByText('widget')).not.toBeInTheDocument();
  });

  it('draws a labeled box for each registered node once enabled', async () => {
    setXRayModeEnabled(true);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>
    );

    await waitFor(() => {
      expect(screen.getByText('widget')).toBeInTheDocument();
    });
  });

  it('shows the node data panel when its label is clicked', async () => {
    setXRayModeEnabled(true);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>
    );

    const label = await screen.findByText('widget');
    await userEvent.click(label, {advanceTimers: jest.advanceTimersByTime});

    await waitFor(() => {
      expect(screen.getByText(/"title": "Error Rate"/)).toBeInTheDocument();
    });
  });

  it('caps the data panel to a node box smaller than the panel min size', async () => {
    setXRayModeEnabled(true);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>
    );

    const label = await screen.findByText('widget');
    await userEvent.click(label, {advanceTimers: jest.advanceTimersByTime});

    const panel = await screen.findByText(/"title": "Error Rate"/);
    const panelEl = panel.closest('div[style*="max-width"]')!;

    // The node's box (100x50 from the `rect()` fixture) is smaller than the
    // panel's usual 420x320 floor — min must never exceed max, or the panel
    // spills past the box it's supposed to be capped to (CSS lets a
    // min-width beat a smaller max-width).
    expect(panelEl).toHaveStyle({maxWidth: '100px'});
    expect(panelEl).toHaveStyle({maxHeight: '50px'});
    expect(parseFloat(panelEl.style.minWidth)).toBeLessThanOrEqual(100);
    expect(parseFloat(panelEl.style.minHeight)).toBeLessThanOrEqual(50);
  });

  it('reacts to the store toggling on after mount', async () => {
    setXRayModeEnabled(false);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>
    );

    expect(screen.queryByText('widget')).not.toBeInTheDocument();

    act(() => {
      setXRayModeEnabled(true);
    });

    await waitFor(() => {
      expect(screen.getByText('widget')).toBeInTheDocument();
    });
  });
});
