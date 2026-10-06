import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {
  TraceItemResponseAttribute,
  TraceItemResponseLink,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import {EapSpanNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/eapSpanNode';
import {
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';
import {DEFAULT_TRACE_VIEW_PREFERENCES} from 'sentry/views/performance/traceDetails/traceState/tracePreferences';
import {TraceStateProvider} from 'sentry/views/performance/traceDetails/traceState/traceStateProvider';

import {CacheLifecycleSection} from './cacheLifecycle';

const ORIGIN_SPAN_ID = 'b415e097df49bf1c';
const ORIGIN_TRACE_ID = '6edf623ed48e4172a54e7fbee3b40c5d';
const CACHE_KEY = '133fefc9b81c';
const SOURCE_FILE = 'app/(cached-nesting)/mixed-lifetimes/[id]/page.tsx';
const ORIGIN_SPAN_URL = `/projects/org-slug/project_slug/trace-items/${ORIGIN_SPAN_ID}/`;

describe('CacheLifecycleSection', () => {
  const organization = OrganizationFixture();
  const location = LocationFixture();
  const project = ProjectFixture({id: '1', slug: 'project_slug'});

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  function makeCacheNode(op: string) {
    // Recent, so the fill time of short-lived entries is inside span retention.
    const startTimestamp = Date.now() / 1000 - 60;
    return new EapSpanNode(
      null,
      makeEAPSpan({
        event_id: 'read-span-id',
        op,
        project_id: 1,
        project_slug: project.slug,
        start_timestamp: startTimestamp,
        end_timestamp: startTimestamp + 0.001,
      }),
      {organization}
    );
  }

  function makeCacheAttributes(options: {
    operation: 'get' | 'put';
    hit?: boolean;
    itemAgeSeconds?: number;
    key?: string;
    sourceFilePath?: string;
    ttlSeconds?: number;
  }): TraceItemResponseAttribute[] {
    const attributes: TraceItemResponseAttribute[] = [
      {name: 'cache.operation', type: 'str', value: options.operation},
      {name: 'span.duration', type: 'float', value: 0.21},
    ];
    if (options.hit !== undefined) {
      attributes.push({name: 'cache.hit', type: 'bool', value: options.hit});
    }
    if (options.itemAgeSeconds !== undefined) {
      attributes.push({
        name: 'cache.item_age',
        type: 'int',
        value: options.itemAgeSeconds,
      });
    }
    if (options.ttlSeconds !== undefined) {
      attributes.push({name: 'cache.ttl', type: 'int', value: options.ttlSeconds});
    }
    if (options.key !== undefined) {
      attributes.push({name: 'cache.key', type: 'str', value: options.key});
    }
    if (options.sourceFilePath !== undefined) {
      attributes.push({
        name: 'code.file.path',
        type: 'str',
        value: options.sourceFilePath,
      });
    }
    return attributes;
  }

  function makeOriginLink(
    overrides: Partial<TraceItemResponseLink> = {}
  ): TraceItemResponseLink {
    return {
      itemId: ORIGIN_SPAN_ID,
      traceId: ORIGIN_TRACE_ID,
      sampled: true,
      attributes: [{name: 'sentry.link.type', type: 'str', value: 'cache_origin'}],
      ...overrides,
    };
  }

  function mockOriginSpanRequest() {
    return MockApiClient.addMockResponse({
      url: ORIGIN_SPAN_URL,
      match: [MockApiClient.matchQuery({referrer: 'api.trace-view.cache-origin'})],
      body: {
        itemId: ORIGIN_SPAN_ID,
        timestamp: '2026-10-01T08:43:49Z',
        attributes: [
          {name: 'transaction', type: 'str', value: 'GET /mixed-lifetimes/[id]'},
          {name: 'span.op', type: 'str', value: 'cache.put'},
          {name: 'span.duration', type: 'float', value: 0.37},
          {name: 'code.file.path', type: 'str', value: SOURCE_FILE},
        ],
        links: [],
      },
    });
  }

  function TestSection(props: React.ComponentProps<typeof CacheLifecycleSection>) {
    return (
      <TraceStateProvider initialPreferences={DEFAULT_TRACE_VIEW_PREFERENCES}>
        <CacheLifecycleSection {...props} />
      </TraceStateProvider>
    );
  }

  it('renders nothing for a span without a cache operation', () => {
    const {container} = render(
      <TestSection
        node={makeCacheNode('db.query')}
        attributes={[{name: 'span.duration', type: 'float', value: 0.21}]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('shows the hit, entry age and expiry for a cache hit', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({
          operation: 'get',
          hit: true,
          itemAgeSeconds: 9,
          ttlSeconds: 50,
        })}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('Hit')).toBeInTheDocument();
    expect(screen.getByText('Cache filled')).toBeInTheDocument();
    expect(screen.getByText('9s earlier')).toBeInTheDocument();
    expect(screen.getByText('Cache hit')).toBeInTheDocument();
    expect(screen.getByText('cache.get took 0.21ms')).toBeInTheDocument();
    expect(screen.getByText(/age 9s/)).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('41s later')).toBeInTheDocument();
    expect(screen.getByText('ttl 50s')).toBeInTheDocument();
    // Without a span link, there is no origin to open.
    expect(
      screen.queryByRole('button', {name: 'Open origin span'})
    ).not.toBeInTheDocument();
  });

  it('loads the linked fill span and shows the origin details', async () => {
    const originRequest = mockOriginSpanRequest();

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({
          operation: 'get',
          hit: true,
          itemAgeSeconds: 9,
          ttlSeconds: 50,
        })}
        links={[makeOriginLink()]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(await screen.findByText('GET /mixed-lifetimes/[id]')).toBeInTheDocument();
    expect(screen.getByText(SOURCE_FILE)).toBeInTheDocument();
    expect(screen.getByText('cache.put took 0.37ms')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open origin span'})).toBeInTheDocument();
    expect(originRequest).toHaveBeenCalledTimes(1);
  });

  it('shows a skeleton above the button while the origin span loads', async () => {
    mockOriginSpanRequest();

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[makeOriginLink()]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getAllByTestId('loading-placeholder')).toHaveLength(2);
    expect(screen.getByRole('button', {name: 'Open origin span'})).toBeInTheDocument();
    expect(await screen.findByText('GET /mixed-lifetimes/[id]')).toBeInTheDocument();
    expect(screen.queryByTestId('loading-placeholder')).not.toBeInTheDocument();
  });

  it('skips the fill span request when the fill is past span retention', () => {
    const originRequest = mockOriginSpanRequest();

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({
          operation: 'get',
          hit: true,
          itemAgeSeconds: 50 * 24 * 60 * 60,
        })}
        links={[makeOriginLink()]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(
      screen.getByText('Origin trace is older than your 30-day span retention')
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open origin span'})
    ).not.toBeInTheDocument();
    expect(originRequest).not.toHaveBeenCalled();
  });

  // A 404 can mean the span is in another project, and the trace view can
  // still find it there.
  it.each([404, 500])(
    'keeps the origin link when the fill span request fails with %s',
    async statusCode => {
      MockApiClient.addMockResponse({
        url: ORIGIN_SPAN_URL,
        statusCode,
        body: {detail: 'Error'},
      });

      render(
        <TestSection
          node={makeCacheNode('cache.get')}
          attributes={makeCacheAttributes({
            operation: 'get',
            hit: true,
            itemAgeSeconds: 9,
          })}
          links={[makeOriginLink()]}
          location={location}
          organization={organization}
          onTabScrollToNode={jest.fn()}
        />
      );

      expect(await screen.findByText('Span preview unavailable')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Open origin span'})).toBeInTheDocument();
    }
  );

  it('does not fetch a fill span from an unsampled trace', () => {
    const originRequest = mockOriginSpanRequest();

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[makeOriginLink({sampled: false})]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(
      screen.getByText(
        'The trace that filled this cache entry was not sampled, so it is not available'
      )
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open origin span'})
    ).not.toBeInTheDocument();
    expect(originRequest).not.toHaveBeenCalled();
  });

  // The backend currently drops typed link attributes (see the TODO in
  // findCacheOriginLink), so a lone link without a type must count as origin.
  it('treats a single untyped link as the cache origin', async () => {
    mockOriginSpanRequest();

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[makeOriginLink({attributes: []})]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(await screen.findByText('GET /mixed-lifetimes/[id]')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open origin span'})).toBeInTheDocument();
  });

  it('does not guess an origin from several untyped links', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[
          makeOriginLink({attributes: []}),
          makeOriginLink({itemId: 'another-span-id', attributes: []}),
        ]}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(
      screen.queryByRole('button', {name: 'Open origin span'})
    ).not.toBeInTheDocument();
  });

  // Regression: duration and miss message were adjacent JSX text nodes and
  // rendered merged as "0.21msno entry was found".
  it('keeps the miss message separate from the read duration', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: false, key: CACHE_KEY})}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('Miss')).toBeInTheDocument();
    expect(screen.getByText('Cache miss')).toBeInTheDocument();
    expect(screen.getByText('cache.get took 0.21ms')).toBeInTheDocument();
    expect(screen.getByText(/no entry for key/)).toBeInTheDocument();
    expect(screen.getByText(CACHE_KEY)).toBeInTheDocument();
    expect(screen.queryByText('Cache filled')).not.toBeInTheDocument();
    expect(screen.queryByText('Expires')).not.toBeInTheDocument();
  });

  it('falls back to a generic miss message without a cache key', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: false})}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('the entry was not in the cache')).toBeInTheDocument();
  });

  it('shows a neutral read row when cache.hit is missing', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get'})}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('Cache read')).toBeInTheDocument();
    expect(screen.queryByText('Hit')).not.toBeInTheDocument();
    expect(screen.queryByText('Miss')).not.toBeInTheDocument();
  });

  it('describes the write and its expiry on a cache.put span', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.put')}
        attributes={makeCacheAttributes({
          operation: 'put',
          key: CACHE_KEY,
          sourceFilePath: SOURCE_FILE,
          ttlSeconds: 50,
        })}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('Cache filled')).toBeInTheDocument();
    expect(screen.getByText('this span')).toBeInTheDocument();
    expect(screen.getByText('cache.put took 0.21ms')).toBeInTheDocument();
    expect(screen.getByText(CACHE_KEY)).toBeInTheDocument();
    expect(screen.getByText(SOURCE_FILE)).toBeInTheDocument();
    expect(screen.getByText('Expires')).toBeInTheDocument();
    expect(screen.getByText('50s later')).toBeInTheDocument();
    expect(screen.getByText('ttl 50s')).toBeInTheDocument();
  });

  it('hides the expiry row when the put span has no ttl', () => {
    render(
      <TestSection
        node={makeCacheNode('cache.put')}
        attributes={makeCacheAttributes({operation: 'put', key: CACHE_KEY})}
        location={location}
        organization={organization}
        onTabScrollToNode={jest.fn()}
      />
    );

    expect(screen.getByText('Cache filled')).toBeInTheDocument();
    expect(screen.queryByText('Expires')).not.toBeInTheDocument();
  });

  // Regression: the replay trace view merges several traces into one tree, so
  // the fill span can be on screen even when its trace id differs.
  it('scrolls to the fill span when it is in the tree, even from another trace', async () => {
    mockOriginSpanRequest();
    const onTabScrollToNode = jest.fn();
    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({event_id: ORIGIN_SPAN_ID, op: 'cache.put', is_transaction: true}),
      ]),
      {organization, replay: null}
    );

    render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[makeOriginLink()]}
        tree={tree}
        location={location}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Open origin span'}));

    expect(onTabScrollToNode).toHaveBeenCalledTimes(1);
    expect(onTabScrollToNode.mock.calls[0][0].id).toBe(ORIGIN_SPAN_ID);
  });

  it('navigates to the origin trace when the fill span is not in the tree', async () => {
    mockOriginSpanRequest();
    const onTabScrollToNode = jest.fn();
    const tree = TraceTree.FromTrace(
      makeEAPTrace([
        makeEAPSpan({
          event_id: 'some-other-span',
          op: 'http.server',
          is_transaction: true,
        }),
      ]),
      {organization, replay: null}
    );

    const {router} = render(
      <TestSection
        node={makeCacheNode('cache.get')}
        attributes={makeCacheAttributes({operation: 'get', hit: true, itemAgeSeconds: 9})}
        links={[makeOriginLink()]}
        tree={tree}
        location={location}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />,
      {initialRouterConfig: {location: {pathname: '/'}}}
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Open origin span'}));

    expect(onTabScrollToNode).not.toHaveBeenCalled();
    expect(router.location.pathname).toContain(ORIGIN_TRACE_ID);
  });
});
