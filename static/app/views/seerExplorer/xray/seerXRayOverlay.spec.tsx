import {act} from 'react';
import {OrganizationFixture} from 'sentry-fixture/organization';

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

const organization = OrganizationFixture({features: ['seer-xray']});

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
  // jsdom doesn't implement Range#getBoundingClientRect at all, so this is
  // `undefined` — captured here so afterEach can put the prototype back the
  // way it found it instead of leaking the stub to other spec files.
  const originalRangeGetBoundingClientRect = Range.prototype.getBoundingClientRect;

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
    Range.prototype.getBoundingClientRect = originalRangeGetBoundingClientRect;
  });

  it('renders nothing when XRay mode is disabled', () => {
    setXRayModeEnabled(false);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
    );

    expect(screen.queryByText('widget')).not.toBeInTheDocument();
  });

  it('stays off without the seer-xray feature, even if localStorage says enabled', () => {
    setXRayModeEnabled(true);
    const organizationWithoutFlag = OrganizationFixture({features: []});
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization: organizationWithoutFlag}
    );

    // The cmd+k toggle is the only UI for turning this off, and it's hidden
    // without the flag — so a stale localStorage value must not leave the
    // overlay running with no way to disable it.
    expect(screen.queryByText('widget')).not.toBeInTheDocument();
  });

  it('draws a labeled box for each registered node once enabled', async () => {
    setXRayModeEnabled(true);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
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
      </LLMContextProvider>,
      {organization}
    );

    const label = await screen.findByText('widget');
    await userEvent.click(label, {advanceTimers: jest.advanceTimersByTime});

    await waitFor(() => {
      expect(screen.getByText(/"title": "Error Rate"/)).toBeInTheDocument();
    });
  });

  it('keeps a reasonable min size for the data panel even on a tiny node box', async () => {
    setXRayModeEnabled(true);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
    );

    const label = await screen.findByText('widget');
    await userEvent.click(label, {advanceTimers: jest.advanceTimersByTime});

    const panelBody = await screen.findByText(/"title": "Error Rate"/);
    // `panelBody` is the <pre> (NodeDataPanelBody); its direct parent is the
    // sized NodeDataPanel div itself.
    const panelEl = panelBody.parentElement!;

    // The node's box (100x50 from the `rect()` fixture) is far too small to
    // hold readable JSON, so the panel keeps its fixed floor size — same as
    // any tooltip/popover anchored to a small trigger — even though that
    // means it extends past the box. `max` still tracks the (small) box, so
    // it only ever grows past it via `min`, never arbitrarily.
    expect(panelEl).toHaveStyle({maxWidth: '100px', maxHeight: '50px'});
    expect(panelEl).toHaveStyle({minWidth: '420px', minHeight: '320px'});
  });

  it('flips the label below the box when there is no room above it', async () => {
    setXRayModeEnabled(true);
    Range.prototype.getBoundingClientRect = jest.fn().mockReturnValue(rect({top: 0}));

    const {unmount} = render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
    );
    const flippedLabel = await screen.findByText('widget');
    const flippedClassName = flippedLabel.className;
    unmount();

    // Same node, far enough from the viewport's top edge that the label has
    // room to sit above the box as usual — the two must style differently,
    // proving the flip is actually driven by `node.rect.top`.
    Range.prototype.getBoundingClientRect = jest.fn().mockReturnValue(rect({top: 200}));
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
    );
    const normalLabel = await screen.findByText('widget');

    expect(normalLabel).not.toHaveClass(flippedClassName, {exact: true});
  });

  it('reacts to the store toggling on after mount', async () => {
    setXRayModeEnabled(false);
    render(
      <LLMContextProvider>
        <ContextWidget title="Error Rate" />
        <SeerXRayOverlay />
      </LLMContextProvider>,
      {organization}
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
