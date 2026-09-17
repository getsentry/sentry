import {act, render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useTraceQueryWriter, type TraceQueryWriter} from './useTraceQueryWriter';

function Probe({onReady}: {onReady: (writer: TraceQueryWriter) => void}) {
  const writer = useTraceQueryWriter();
  onReady(writer);
  return <div data-test-id="probe" />;
}

function renderWriter(query: Record<string, string> = {}) {
  let writer!: TraceQueryWriter;
  const {router} = render(<Probe onReady={next => (writer = next)} />, {
    initialRouterConfig: {
      location: {pathname: '/organizations/org-slug/performance/trace/trace-id/', query},
    },
  });

  return {router, getWriter: () => writer};
}

describe('useTraceQueryWriter', () => {
  it('keeps params written by earlier callbacks that the router has not rendered yet', async () => {
    // The waterfall writes the URL from several debounced callbacks. Merging onto the
    // location the component can see drops params written since the last render, which is
    // what silently unselected the waterfall's node when the field of view synced after it.
    const {router, getWriter} = renderWriter({pinnedAttribute: 'custom.region'});

    act(() => getWriter().writeQuery({node: 'span-pin-root'}));
    act(() => getWriter().writeQuery({fov: '100,500'}));

    await waitFor(() => expect(router.location.query.fov).toBe('100,500'));
    expect(router.location.query.node).toBe('span-pin-root');
    expect(router.location.query.pinnedAttribute).toBe('custom.region');
  });

  it('reads back the params it has written', () => {
    const {getWriter} = renderWriter({pinnedAttribute: 'custom.region'});

    expect(getWriter().getQuery().node).toBeUndefined();

    act(() => getWriter().writeQuery({node: 'span-pin-root'}));

    expect(getWriter().getQuery().node).toBe('span-pin-root');
    expect(getWriter().getQuery().pinnedAttribute).toBe('custom.region');
  });

  it('removes params set to undefined', async () => {
    const {router, getWriter} = renderWriter({eventId: 'abc', fov: '100,500'});

    act(() => getWriter().writeQuery({node: 'span-pin-root', eventId: undefined}));

    await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));
    expect(router.location.query.eventId).toBeUndefined();
    expect(router.location.query.fov).toBe('100,500');
  });

  it('adopts params changed outside of the waterfall', async () => {
    const {router, getWriter} = renderWriter({pinnedAttribute: 'custom.region'});

    act(() => getWriter().writeQuery({node: 'span-pin-root'}));
    await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));

    // Something else on the page changes the environment.
    router.navigate({
      pathname: '/organizations/org-slug/performance/trace/trace-id/',
      search: '?node=span-pin-root&environment=prod',
    });
    await waitFor(() => expect(getWriter().getQuery().environment).toBe('prod'));

    act(() => getWriter().writeQuery({fov: '100,500'}));

    await waitFor(() => expect(router.location.query.fov).toBe('100,500'));
    expect(router.location.query.environment).toBe('prod');
    expect(router.location.query.node).toBe('span-pin-root');
    // pinnedAttribute was dropped by the external navigate, so it must not come back.
    expect(router.location.query.pinnedAttribute).toBeUndefined();
  });
});
