import {useLayoutEffect} from 'react';
import * as Sentry from '@sentry/react';
import MockDate from 'mockdate';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  render,
  screen,
  userEvent,
  waitFor,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';
import {setWindowLocation} from 'sentry-test/utils';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useLocation} from 'sentry/utils/useLocation';
import TraceView from 'sentry/views/performance/traceDetails/index';
import {
  makeEAPError,
  makeEAPSpan,
  makeEAPTrace,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

class MockResizeObserver {
  callback: ResizeObserverCallback;
  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
  }

  unobserve(_element: HTMLElement) {
    return;
  }

  observe(element: HTMLElement) {
    setTimeout(() => {
      this.callback(
        [
          {
            target: element,
            // @ts-expect-error partial mock
            contentRect: {width: 1000, height: 24 * 20 - 1},
          },
        ],
        this
      );
    }, 0);
  }
  disconnect() {}
}

type ResponseType = Parameters<typeof MockApiClient.addMockResponse>[0];

function mockQueryString(queryString: `?${string}` | '') {
  setWindowLocation(
    `http://localhost/organizations/org-slug/performance/trace/trace-id/${queryString}`
  );
  expect(window.location.search).toBe(queryString);
}

function mockTraceResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: {}}),
  });
}

function mockPerformanceSubscriptionDetailsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/customers/org-slug/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: {}}),
  });
}

function mockTraceMetaResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-meta/trace-id/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {
      body: {
        errorsCount: 0,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 0,
        spansCount: 200,
        spansCountMap: {},
        uptimeCount: 0,
      },
    }),
  });
}

function mockTraceTagsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    method: 'GET',
    asyncDelay: 1,
    ...(resp ?? {body: []}),
  });
}

function mockProjectDetailsResponse(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/projects/org-slug//',
    method: 'GET',
    asyncDelay: 1,
    ...resp,
  });
}

function mockTraceRootFacets(resp?: Partial<ResponseType>) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events-facets/',
    method: 'GET',
    asyncDelay: 1,
    body: {},
    ...resp,
  });
}

const initialRouterConfig: RouterConfig = {
  location: {
    pathname: '/organizations/org-slug/performance/trace/trace-id/',
    query: {},
  },
  route: '/organizations/:orgId/performance/trace/:traceSlug/',
};

function mockEventsResponse() {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/events/',
    method: 'GET',
    body: {
      data: [],
      queries: [],
    },
  });
}
const VISIBLE_TRACE_ROW_SELECTOR = '.TraceRow:not(.Hidden)';
const DRAWER_TABS_TEST_ID = 'trace-drawer-tab';
const DRAWER_TABS_PIN_BUTTON_TEST_ID = 'trace-drawer-tab-pin-button';

function setupEAPTraceView() {
  const start = 1;
  const trace = makeEAPTrace([
    makeEAPSpan({
      event_id: 'root-transaction',
      description: 'root transaction',
      is_transaction: true,
      start_timestamp: start,
      end_timestamp: start + 1,
    }),
    makeEAPSpan({
      event_id: 'second-transaction',
      description: 'second transaction',
      is_transaction: true,
      start_timestamp: start + 1,
      end_timestamp: start + 2,
    }),
    makeEAPSpan({
      event_id: 'third-transaction',
      description: 'third transaction',
      is_transaction: true,
      start_timestamp: start + 2,
      end_timestamp: start + 3,
    }),
  ]);

  mockPerformanceSubscriptionDetailsResponse();
  mockProjectDetailsResponse();
  mockTraceResponse({body: trace});
  mockTraceMetaResponse({
    body: {
      errorsCount: 0,
      logsCount: 0,
      metricsCount: 0,
      performanceIssuesCount: 0,
      spansCount: 3,
      spansCountMap: {},
      uptimeCount: 0,
    },
  });
  mockTraceRootFacets();
  mockEventsResponse();
  MockApiClient.addMockResponse({url: '/organizations/org-slug/logs/', body: {data: []}});
  MockApiClient.addMockResponse({url: '/organizations/org-slug/dashboards/', body: []});

  for (const itemId of ['root-transaction', 'second-transaction', 'third-transaction']) {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
      body: {
        itemId,
        links: null,
        meta: {},
        timestamp: new Date(1e3 * start).toISOString(),
        attributes: [],
      },
    });
  }
}

describe('trace view', () => {
  beforeEach(() => {
    globalThis.ResizeObserver = MockResizeObserver;
    mockQueryString('');
    MockDate.reset();

    const project = ProjectFixture({
      slug: 'project_slug',
      id: '1',
      name: 'project_name',
      isMember: true,
    });

    ProjectsStore.loadInitialData([project]);

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [parseInt(project.id, 10)],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: null,
      },
    });
  });
  afterEach(() => {
    mockQueryString('');
    // @ts-expect-error clear mock
    globalThis.ResizeObserver = undefined;
  });

  describe('attribute pinning', () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    function SyncWindowLocation({children}: {children: React.ReactNode}) {
      const location = useLocation();
      useLayoutEffect(() => {
        // The memory router does not update the browser URL, which the waterfall's
        // debounced selection and zoom callbacks read when merging query parameters.
        setWindowLocation(
          `http://localhost${location.pathname}${location.search}${location.hash}`
        );
      }, [location]);
      return children;
    }

    function setupPinnedTrace(features = ['trace-waterfall-attribute-pinning']) {
      jest
        .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
        .mockReturnValue(new DOMRect(0, 0, 1000, 500));
      const start = Date.now() / 1000;
      const root = makeEAPSpan({
        event_id: 'pin-root',
        event_type: 'span',
        description: 'pinnable root',
        is_transaction: true,
        start_timestamp: start,
        end_timestamp: start + 1,
        children: [
          makeEAPSpan({
            event_id: 'pin-child',
            event_type: 'span',
            description: 'pinnable child',
            start_timestamp: start,
            end_timestamp: start + 0.5,
          }),
        ],
      });
      const organization = OrganizationFixture({features});
      mockPerformanceSubscriptionDetailsResponse();
      mockProjectDetailsResponse();
      mockTraceRootFacets();
      mockEventsResponse();
      const traceRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [root],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace-meta/trace-id/',
        body: {
          errorsCount: 0,
          logsCount: 0,
          metricsCount: 0,
          performanceIssuesCount: 0,
          spansCount: 2,
          spansCountMap: {},
        },
      });
      for (const itemId of ['pin-root', 'pin-child']) {
        MockApiClient.addMockResponse({
          url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
          body: {
            itemId,
            links: null,
            meta: {},
            timestamp: new Date(start * 1000).toISOString(),
            attributes: [
              {name: 'custom.region', type: 'str', value: 'drawer-region'},
              {name: 'tags[custom.size,number]', type: 'int', value: 0},
              {
                name: 'tags[custom.enabled,boolean]',
                type: 'bool',
                value: false,
              },
            ],
          },
        });
      }
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/logs/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });
      function renderTrace(query: Record<string, string> = {}) {
        mockQueryString(
          Object.keys(query).length ? `?${new URLSearchParams(query)}` : ''
        );
        return render(<TraceView />, {
          organization,
          additionalWrapper: SyncWindowLocation,
          initialRouterConfig: {
            ...initialRouterConfig,
            location: {
              pathname: '/organizations/org-slug/performance/trace/trace-id/',
              query,
            },
          },
        });
      }
      return {root, traceRequest, renderTrace};
    }

    async function openAttributeMenu(attribute: string) {
      const key = await screen.findByTestId(`tree-key-${attribute}`);
      const row = key.closest<HTMLElement>('[data-test-id="attribute-tree-row"]')!;
      await userEvent.click(
        within(row).getByRole('button', {name: 'Attribute Actions Menu'})
      );
    }

    function pinnedCell(description: string) {
      const waterfall = within(screen.getByTestId('trace-virtualized-list'));
      const row = waterfall.getByText(description).closest<HTMLElement>('.TraceRow')!;
      return within(row.querySelector<HTMLElement>('.TracePinnedAttributeCell')!);
    }

    it('shows loaded values and missing attributes while later pages are pending', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const unloadedChild = makeEAPSpan({
        event_id: 'unloaded-child',
        event_type: 'span',
        description: 'unloaded child',
        start_timestamp: root.start_timestamp,
        end_timestamp: root.end_timestamp,
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [{...root, children: [...root.children, unloadedChild]}],
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [
          MockApiClient.matchQuery({
            field: ['span_id', 'custom.region'],
            cursor: undefined,
          }),
        ],
        body: {
          data: [
            {span_id: root.event_id, 'custom.region': 'root-region'},
            {span_id: root.children[0]!.event_id, 'custom.region': null},
          ],
        },
        headers: {
          Link: '<https://sentry.io/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
        },
      });
      const nextPage = Promise.withResolvers<void>();
      const nextRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
        asyncDelay: nextPage.promise,
        body: {
          data: [{span_id: unloadedChild.event_id, 'custom.region': 0}],
        },
      });
      renderTrace({pinnedAttribute: 'custom.region'});

      expect(await screen.findByText('root-region')).toBeInTheDocument();
      await waitFor(() => expect(nextRequest).toHaveBeenCalled());
      expect(
        pinnedCell('pinnable root').getByRole('button', {
          name: 'Copy attribute value',
        })
      ).toBeEnabled();
      expect(pinnedCell('pinnable child').getByText('—')).toBeInTheDocument();
      expect(
        pinnedCell('pinnable child').queryByTestId('loading-indicator')
      ).not.toBeInTheDocument();
      expect(
        pinnedCell('unloaded child').getByTestId('loading-indicator')
      ).toBeInTheDocument();

      act(() => nextPage.resolve());
      expect(await pinnedCell('unloaded child').findByText('0')).toBeInTheDocument();
    });

    it('keeps pinned values loaded when navigating from an error deep link', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const errors = [
        makeEAPError({
          event_id: '11111111111141118111111111111111',
          description: 'first selectable error',
          start_timestamp: root.start_timestamp + 0.25,
        }),
        makeEAPError({
          event_id: '22222222222242228222222222222222',
          description: 'second selectable error',
          start_timestamp: root.start_timestamp + 0.5,
        }),
      ];
      const traceRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        body: [root, ...errors],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        asyncDelay: 100,
        body: {
          data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}],
        },
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/1/',
        body: GroupFixture(),
      });
      const query = {
        pinnedAttribute: 'custom.region',
        eventId: errors[0]!.event_id,
      };
      const {router} = renderTrace(query);
      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      const waterfall = within(screen.getByTestId('trace-virtualized-list'));

      for (const item of [root, ...errors, root]) {
        const description = waterfall.getByText(item.description!);
        // Deep links animate the waterfall before enabling pointer interaction.
        await waitFor(() =>
          expect(screen.getByTestId('trace-virtualized-list')).not.toHaveStyle({
            pointerEvents: 'none',
          })
        );
        await userEvent.click(description);
        await waitFor(() =>
          expect(router.location.query.node).toBe(`${item.event_type}-${item.event_id}`)
        );
        expect(attributeRequest).toHaveBeenCalledTimes(1);
        expect(waterfall.getByText('waterfall-region')).toBeInTheDocument();
      }

      expect(traceRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest.mock.calls[0]![1].query).toMatchObject({
        dataset: 'spans',
        field: ['span_id', 'custom.region'],
        query: 'trace:trace-id',
        project: -1,
        sampling: 'HIGHEST_ACCURACY',
      });
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('errorId');
    });

    it.each(['first', 'next'])(
      'keeps the trace usable and retries a failed %s events page',
      async failedPage => {
        const {renderTrace, root, traceRequest} = setupPinnedTrace();
        const firstPage = {
          url: '/organizations/org-slug/events/',
          match: [
            MockApiClient.matchQuery({
              field: ['span_id', 'custom.region'],
              cursor: undefined,
            }),
          ],
          body: {
            data: [{span_id: root.event_id, 'custom.region': 'root-region'}],
          },
          headers: {
            Link: '<https://sentry.io/api/0/organizations/org-slug/events/?cursor=0:100:0>; rel="next"; results="true"; cursor="0:100:0"',
          },
        };
        const nextPage = {
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({cursor: '0:100:0'})],
          body: {
            data: [
              {
                span_id: root.children[0]!.event_id,
                'custom.region': 'child-region',
              },
            ],
          },
        };
        MockApiClient.addMockResponse(firstPage);
        MockApiClient.addMockResponse(nextPage);
        const failedResponse = failedPage === 'first' ? firstPage : nextPage;
        const failedRequest = MockApiClient.addMockResponse({
          ...failedResponse,
          statusCode: 500,
        });
        const {router} = renderTrace({pinnedAttribute: 'custom.region'});

        expect(await screen.findByText('Could not load attribute')).toBeInTheDocument();
        expect(failedRequest).toHaveBeenCalledTimes(1);
        expect(pinnedCell('pinnable child').getByText('—')).toBeInTheDocument();
        if (failedPage === 'next') {
          expect(screen.getByText('root-region')).toBeInTheDocument();
          expect(
            pinnedCell('pinnable root').getByRole('button', {
              name: 'Copy attribute value',
            })
          ).toBeEnabled();
        }
        await userEvent.click(screen.getByText('pinnable root'));
        await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));

        const retry = Promise.withResolvers<void>();
        MockApiClient.addMockResponse({
          ...failedResponse,
          asyncDelay: retry.promise,
        });
        await userEvent.click(
          screen.getByRole('button', {name: 'Retry loading attribute'})
        );
        if (failedPage === 'next') {
          expect(screen.getByText('root-region')).toBeInTheDocument();
          expect(
            pinnedCell('pinnable root').getByRole('button', {
              name: 'Copy attribute value',
            })
          ).toBeEnabled();
        }
        act(() => retry.resolve());

        expect(await screen.findByText('child-region')).toBeInTheDocument();
        expect(screen.getByText('root-region')).toBeInTheDocument();
        expect(screen.queryByText('Could not load attribute')).not.toBeInTheDocument();
        expect(router.location.query.node).toBe('span-pin-root');
        expect(traceRequest).toHaveBeenCalledTimes(1);
      }
    );

    it('waits for the trace to load before showing a shared pin', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        asyncDelay: 500,
        body: [root],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {
          data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}],
        },
      });
      const {router} = renderTrace({pinnedAttribute: 'custom.region'});

      expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Unpin attribute'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('separator', {
          name: 'Resize tree and attribute columns',
        })
      ).not.toBeInTheDocument();
      expect(attributeRequest).not.toHaveBeenCalled();
      expect(router.location.query.pinnedAttribute).toBe('custom.region');

      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Unpin attribute'})).toBeInTheDocument();
      expect(attributeRequest).toHaveBeenCalledTimes(1);
      expect(router.location.query.pinnedAttribute).toBe('custom.region');
    });

    it('preserves pinned child values, selection and zoom when expanding an EAP parent', async () => {
      jest.useFakeTimers();
      const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
      const {renderTrace, root, traceRequest} = setupPinnedTrace();
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {
          data: [
            {span_id: root.event_id, 'custom.region': 'root-region'},
            ...root.children.map(child => ({
              span_id: child.event_id,
              'custom.region': 'child-region',
            })),
          ],
        },
      });
      const query = {pinnedAttribute: 'custom.region', fov: '100,500'};
      const {router} = renderTrace(query);
      expect(await screen.findByText('child-region')).toBeInTheDocument();
      const rootDescription = screen.getByText('pinnable root');
      await user.click(rootDescription);
      await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));
      const rootRow = rootDescription.closest<HTMLElement>('.TraceRow')!;
      const expandButton = within(rootRow).getByRole('button', {name: '1'});

      await user.click(expandButton);
      expect(screen.queryByText('child-region')).not.toBeInTheDocument();
      await user.click(expandButton);

      const childRow = (await screen.findByText('pinnable child')).closest<HTMLElement>(
        '.TraceRow'
      )!;
      expect(within(childRow).getByText('child-region')).toBeInTheDocument();
      expect(within(rootRow).getByText('root-region')).toBeInTheDocument();
      // Let the debounced field-of-view URL update finish before checking selection.
      await act(() => jest.advanceTimersByTimeAsync(1000));
      expect(router.location.query.node).toBe('span-pin-root');
      expect(router.location.query.fov).toBe('100,500');
      expect(router.location.query.pinnedAttribute).toBe('custom.region');
      expect(traceRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest).toHaveBeenCalledTimes(1);
    });

    it('pins, resizes, replaces and unpins an attribute from the drawer', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const regionRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {
          data: [{span_id: root.event_id, 'custom.region': 'waterfall-region'}],
        },
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [
          MockApiClient.matchQuery({
            field: ['span_id', 'tags[custom.size,number]'],
          }),
        ],
        body: {
          data: [{span_id: root.event_id, 'tags[custom.size,number]': 0}],
        },
      });
      const {router} = renderTrace();
      await userEvent.click(await screen.findByText('pinnable root'));
      await waitFor(() => expect(router.location.query.node).toBe('span-pin-root'));
      const nodeBeforePin = router.location.query.node;
      await openAttributeMenu('custom.region');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
      );
      expect(await screen.findByText('waterfall-region')).toBeInTheDocument();
      expect(regionRequest).toHaveBeenCalledTimes(1);
      expect(router.location.query.pinnedAttribute).toBe('custom.region');
      expect(
        within(screen.getByTestId('tree-key-custom.region')).getByRole('img', {
          name: 'Pinned attribute',
        })
      ).toBeInTheDocument();
      expect(router.location.query.node).toEqual(nodeBeforePin);
      for (const name of [
        'Resize tree and attribute columns',
        'Resize attribute and timeline columns',
      ]) {
        const divider = screen.getByRole('separator', {name});
        const previousValue = Number(divider.getAttribute('aria-valuenow'));
        divider.focus();
        await userEvent.keyboard('{ArrowRight}');
        expect(Number(divider.getAttribute('aria-valuenow'))).toBeGreaterThan(
          previousValue
        );
      }
      await openAttributeMenu('tags[custom.size,number]');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
      );
      await waitFor(() =>
        expect(router.location.query.pinnedAttribute).toBe('tags[custom.size,number]')
      );
      expect(screen.queryByText('waterfall-region')).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('tree-key-custom.region')).queryByRole('img', {
          name: 'Pinned attribute',
        })
      ).not.toBeInTheDocument();
      expect(
        within(screen.getByTestId('tree-key-tags[custom.size,number]')).getByRole('img', {
          name: 'Pinned attribute',
        })
      ).toBeInTheDocument();
      expect(
        await screen.findByRole('button', {name: 'Copy attribute value'})
      ).toBeInTheDocument();
      await openAttributeMenu('tags[custom.size,number]');
      await userEvent.click(
        await screen.findByRole('menuitemradio', {
          name: 'Unpin from waterfall',
        })
      );
      expect(router.location.query.pinnedAttribute).toBeUndefined();
      expect(
        screen.queryByRole('img', {name: 'Pinned attribute'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('separator', {
          name: 'Resize tree and attribute columns',
        })
      ).not.toBeInTheDocument();
      expect(router.location.query.node).toEqual(nodeBeforePin);
    });

    it.each([
      {attribute: 'tags[custom.size,number]', value: 0},
      {attribute: 'tags[custom.enabled,boolean]', value: false},
    ])(
      'preserves the typed key for $attribute when pinning and reloading',
      async ({attribute, value}) => {
        const {renderTrace, root} = setupPinnedTrace();
        const attributeRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({field: ['span_id', attribute]})],
          body: {data: [{span_id: root.event_id, [attribute]: value}]},
        });
        const {router, unmount} = renderTrace();
        await userEvent.click(await screen.findByText('pinnable root'));
        await openAttributeMenu(attribute);
        await userEvent.click(
          await screen.findByRole('menuitemradio', {name: 'Pin to waterfall'})
        );
        expect(
          await within(screen.getByTestId('trace-virtualized-list')).findByText(
            String(value)
          )
        ).toBeInTheDocument();
        expect(router.location.query.pinnedAttribute).toBe(attribute);
        expect(attributeRequest).toHaveBeenCalledTimes(1);

        const query = {pinnedAttribute: attribute};
        unmount();
        renderTrace(query);
        expect(
          await within(screen.getByTestId('trace-virtualized-list')).findByText(
            String(value)
          )
        ).toBeInTheDocument();
      }
    );

    it.each([
      {
        name: 'spans 48 hours apart',
        offset: 0.25,
        duration: 0.5,
        childOffset: 172800,
        endOffset: 172801,
      },
      {
        name: 'a subsecond trace',
        offset: 0.25,
        duration: 0.5,
        childOffset: null,
        endOffset: 1,
      },
      {
        name: 'a zero-duration trace',
        offset: 0,
        duration: 0,
        childOffset: null,
        endOffset: 1,
      },
    ])(
      'queries the complete time range for $name',
      async ({offset, duration, childOffset, endOffset}) => {
        const {renderTrace, root} = setupPinnedTrace();
        const base = Math.floor(Date.now() / 1000) - 5 * 86400;
        const start = base + offset;
        const trace = {
          ...root,
          start_timestamp: start,
          end_timestamp: start + duration,
          children:
            childOffset === null
              ? []
              : [
                  makeEAPSpan({
                    event_id: 'late-child',
                    event_type: 'span',
                    description: 'late child',
                    start_timestamp: start + childOffset,
                    end_timestamp: start + childOffset + duration,
                  }),
                ],
        };
        const traceRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/trace/trace-id/',
          body: [trace],
        });
        const attributeRequest = MockApiClient.addMockResponse({
          url: '/organizations/org-slug/events/',
          match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
          body: {
            data: [
              {span_id: trace.event_id, 'custom.region': 'root-region'},
              ...trace.children.map(child => ({
                span_id: child.event_id,
                'custom.region': 'late-region',
              })),
            ],
          },
        });
        // The original window is centered between the spans and includes both.
        // Reanchoring it to the first span would exclude the later one.
        const query = {
          pinnedAttribute: 'custom.region',
          timestamp: String(start + (childOffset ?? 0) / 2),
        };
        renderTrace(query);
        expect(await screen.findByText('root-region')).toBeInTheDocument();
        if (childOffset !== null) {
          expect(await screen.findByText('late-region')).toBeInTheDocument();
        }
        expect(attributeRequest).toHaveBeenCalledWith(
          expect.anything(),
          expect.objectContaining({
            query: expect.objectContaining({
              start: new Date(base * 1000).toISOString(),
              end: new Date((base + endOffset) * 1000).toISOString(),
            }),
          })
        );
        expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
        expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty(
          'statsPeriod'
        );
        expect(traceRequest).toHaveBeenCalledTimes(1);
      }
    );

    it('loads pinned values for a trace found by the wider-range fallback', async () => {
      const {renderTrace, root} = setupPinnedTrace();
      const start = Math.floor(Date.now() / 1000) - 40 * 86400;
      const trace = {
        ...root,
        start_timestamp: start,
        end_timestamp: start + 1,
        children: [],
      };
      const initialRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        match: [MockApiClient.matchQuery({statsPeriod: '14d'})],
        body: [],
      });
      const fallbackRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/trace/trace-id/',
        match: [MockApiClient.matchQuery({statsPeriod: '90d'})],
        body: [trace],
      });
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: {
          data: [{span_id: trace.event_id, 'custom.region': 'older-region'}],
        },
      });
      const query = {pinnedAttribute: 'custom.region', statsPeriod: '14d'};
      renderTrace(query);
      expect(await screen.findByText('older-region')).toBeInTheDocument();
      expect(initialRequest).toHaveBeenCalledTimes(1);
      expect(fallbackRequest).toHaveBeenCalledTimes(1);
      expect(attributeRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            start: new Date(start * 1000).toISOString(),
            end: new Date((start + 2) * 1000).toISOString(),
          }),
        })
      );
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('timestamp');
      expect(attributeRequest.mock.calls[0]![1].query).not.toHaveProperty('statsPeriod');
    });

    it('ignores URL pins and hides controls when the flag is absent', async () => {
      const {renderTrace} = setupPinnedTrace([]);
      const attributeRequest = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/events/',
        match: [MockApiClient.matchQuery({field: ['span_id', 'custom.region']})],
        body: [],
      });
      renderTrace({pinnedAttribute: 'custom.region'});
      await userEvent.click(await screen.findByText('pinnable root'));
      expect(await screen.findByText('drawer-region')).toBeInTheDocument();
      await openAttributeMenu('custom.region');
      expect(
        await screen.findByRole('menuitemradio', {
          name: 'Copy attribute value to clipboard',
        })
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Pin to waterfall'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('menuitemradio', {name: 'Unpin from waterfall'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Unpin attribute'})
      ).not.toBeInTheDocument();
      expect(attributeRequest).not.toHaveBeenCalled();
      await userEvent.keyboard('{Escape}');
    });
  });

  it('renders loading state', async () => {
    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      asyncDelay: 1000,
      body: [],
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(await screen.findByText(/assembling the trace/i)).toBeInTheDocument();
  });

  it('renders error state if trace fails to load', async () => {
    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({statusCode: 404});
    mockTraceMetaResponse({statusCode: 404});
    mockTraceTagsResponse({statusCode: 404});
    mockEventsResponse();

    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(/Woof, we failed to load your trace/i)
    ).toBeInTheDocument();
  });

  it('renders empty state for successfully ingested trace', async () => {
    // set timestamp to 12 minutes ago
    const twelveMinutesAgoInSeconds = Math.floor(
      new Date(Date.now() - 12 * 60 * 1000).getTime() / 1000
    );

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      body: [],
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    mockQueryString(`?timestamp=${twelveMinutesAgoInSeconds.toString()}`);
    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(
        /We were unable to find any spans for this trace\. If you came here from Logs or Application Metrics/i
      )
    ).toBeInTheDocument();
  });

  it('renders empty state for yet to be ingested trace', async () => {
    // set timestamp to 1 minute ago
    const oneMinuteAgoInSeconds = Math.floor(
      new Date(Date.now() - 1 * 60 * 1000).getTime() / 1000
    );

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();

    mockTraceResponse({
      body: [],
    });
    mockTraceMetaResponse();
    mockTraceTagsResponse();
    mockEventsResponse();

    mockQueryString(`?timestamp=${oneMinuteAgoInSeconds.toString()}`);
    render(<TraceView />, {
      initialRouterConfig,
    });
    expect(
      await screen.findByText(
        /We're still processing this trace. Please try refreshing after a minute/i
      )
    ).toBeInTheDocument();
  });

  it('reveals a hidden vital pill source node on click', async () => {
    const start = Date.now() / 1e3;
    const organization = OrganizationFixture();
    const vitalSpanDescription = 'standalone LCP span';

    mockPerformanceSubscriptionDetailsResponse();
    mockProjectDetailsResponse();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace/trace-id/',
      body: makeEAPTrace([
        makeEAPSpan({
          event_id: 'root-transaction',
          op: 'pageload',
          description: 'root transaction',
          start_timestamp: start,
          end_timestamp: start + 2,
          is_transaction: true,
          additional_attributes: {
            'tags[performance.timeOrigin,number]': start,
          },
          children: [
            makeEAPSpan({
              event_id: 'lcp-span',
              op: 'ui.webvital.lcp',
              description: vitalSpanDescription,
              start_timestamp: start + 0.5,
              end_timestamp: start + 0.6,
              measurements: {'measurements.lcp': 500},
            }),
          ],
        }),
        makeEAPSpan({
          event_id: 'second-transaction',
          op: 'http.server',
          description: 'second transaction',
          start_timestamp: start,
          end_timestamp: start + 1,
          is_transaction: true,
          children: Array.from({length: 100}, (_, index) =>
            makeEAPSpan({
              event_id: `second-transaction-span-${index}`,
              start_timestamp: start,
              end_timestamp: start + 0.1,
            })
          ),
        }),
        makeEAPSpan({
          event_id: 'third-transaction',
          op: 'http.server',
          description: 'third transaction',
          start_timestamp: start,
          end_timestamp: start + 1,
          is_transaction: true,
        }),
      ]),
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-meta/trace-id/',
      body: {
        errorsCount: 0,
        logsCount: 0,
        metricsCount: 0,
        performanceIssuesCount: 0,
        spansCount: 104,
        spansCountMap: {},
      },
    });
    for (const itemId of ['root-transaction', 'lcp-span']) {
      MockApiClient.addMockResponse({
        url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
        body: {
          itemId,
          links: null,
          meta: {},
          timestamp: new Date(start * 1e3).toISOString(),
          attributes: [],
        },
      });
    }
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/logs/',
      body: {data: []},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboards/',
      body: [],
    });
    mockTraceRootFacets();
    mockEventsResponse();

    render(<TraceView />, {initialRouterConfig, organization});

    const rootTransaction = await screen.findByText('root transaction');
    expect(screen.queryByText(vitalSpanDescription)).not.toBeInTheDocument();

    await userEvent.click(rootTransaction);
    await userEvent.click(await screen.findByRole('button', {name: 'Close Drawer'}));
    await waitFor(() => {
      expect(screen.queryByTestId('trace-drawer-title')).not.toBeInTheDocument();
    });

    const vitalPill = (await screen.findAllByText('LCP')).find(element =>
      element.classList.contains('TraceIndicatorLabel')
    );
    expect(vitalPill).toBeDefined();

    await userEvent.click(vitalPill!);

    const vitalSpanRow = (await screen.findByText(vitalSpanDescription)).closest(
      VISIBLE_TRACE_ROW_SELECTOR
    );
    expect(vitalSpanRow).toHaveAttribute('tabindex', '0');
    expect(await screen.findByTestId('trace-drawer-title')).toHaveTextContent(
      'SpanID: lcp-span'
    );
  });

  describe('EAP waterfall navigation', () => {
    it('focuses the node from the eventId query parameter', async () => {
      mockQueryString('?eventId=second-transaction');
      setupEAPTraceView();

      render(<TraceView />, {initialRouterConfig});

      const secondTransaction = await screen.findByText('second transaction');
      const secondTransactionRow = secondTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR);
      expect(secondTransactionRow).not.toBeNull();
      await waitFor(() => expect(secondTransactionRow).toHaveFocus());
    });

    it('moves between visible EAP rows with keyboard navigation', async () => {
      setupEAPTraceView();
      render(<TraceView />, {initialRouterConfig});

      const rootTransaction = await screen.findByText('root transaction');
      const rootTransactionRow = rootTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR);
      const secondTransaction = screen.getByText('second transaction');
      const secondTransactionRow = secondTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR);
      await userEvent.click(rootTransactionRow!);
      expect(rootTransactionRow).toHaveFocus();

      await userEvent.keyboard('{arrowdown}');
      await waitFor(() => expect(secondTransactionRow).toHaveFocus());
      await userEvent.keyboard('{arrowup}');
      await waitFor(() => expect(rootTransactionRow).toHaveFocus());
    });

    it('warns when an EAP node from the URL cannot be found', async () => {
      mockQueryString('?eventId=does-not-exist');
      setupEAPTraceView();
      const warning = jest.spyOn(Sentry.logger, 'warn');

      render(<TraceView />, {initialRouterConfig});

      await screen.findByText('root transaction');
      await waitFor(() => {
        expect(warning).toHaveBeenCalledWith('Failed to scroll to node in trace tree');
      });
      warning.mockRestore();
    });
  });

  describe('EAP drawer tabs', () => {
    it('replaces an unpinned tab and creates a new tab after pinning', async () => {
      setupEAPTraceView();
      render(<TraceView />, {initialRouterConfig});

      const secondTransaction = await screen.findByText('second transaction');
      await userEvent.click(secondTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR)!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
      });
      expect(screen.getByTestId(DRAWER_TABS_TEST_ID)).toHaveTextContent(
        'second transaction'
      );

      const thirdTransaction = await screen.findByText('third transaction');
      await userEvent.click(thirdTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR)!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(1);
        expect(screen.getByTestId(DRAWER_TABS_TEST_ID)).toHaveTextContent(
          'third transaction'
        );
      });

      await userEvent.click(screen.getByTestId(DRAWER_TABS_PIN_BUTTON_TEST_ID));
      const rootTransaction = await screen.findByText('root transaction');
      await userEvent.click(rootTransaction.closest(VISIBLE_TRACE_ROW_SELECTOR)!);
      await waitFor(() => {
        expect(screen.queryAllByTestId(DRAWER_TABS_TEST_ID)).toHaveLength(2);
      });
    });
  });

  describe('pageload', () => {
    it('expands and collapses loaded EAP children with keyboard navigation', async () => {
      mockPerformanceSubscriptionDetailsResponse();
      mockProjectDetailsResponse();
      mockTraceResponse({
        body: makeEAPTrace([
          makeEAPSpan({
            event_id: 'root-transaction',
            description: 'root transaction',
            is_transaction: true,
            start_timestamp: 1,
            end_timestamp: 3,
            children: [
              makeEAPSpan({
                event_id: 'special-span',
                description: 'special span',
                start_timestamp: 1.5,
                end_timestamp: 2,
              }),
              ...Array.from({length: 100}, (_, index) =>
                makeEAPSpan({
                  event_id: `other-span-${index}`,
                  start_timestamp: 1.5,
                  end_timestamp: 2,
                })
              ),
            ],
          }),
          makeEAPSpan({
            event_id: 'second-transaction',
            description: 'second transaction',
            is_transaction: true,
            start_timestamp: 1,
            end_timestamp: 2,
          }),
          makeEAPSpan({
            event_id: 'third-transaction',
            description: 'third transaction',
            is_transaction: true,
            start_timestamp: 1,
            end_timestamp: 2,
          }),
        ]),
      });
      mockTraceMetaResponse({
        body: {
          errorsCount: 0,
          logsCount: 0,
          metricsCount: 0,
          performanceIssuesCount: 0,
          spansCount: 103,
          spansCountMap: {},
        },
      });
      mockTraceRootFacets();
      mockEventsResponse();
      for (const itemId of ['root-transaction', 'special-span']) {
        MockApiClient.addMockResponse({
          url: `/projects/org-slug/project_slug/trace-items/${itemId}/`,
          body: {
            itemId,
            links: null,
            meta: {},
            timestamp: new Date(1e3).toISOString(),
            attributes: [],
          },
        });
      }
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/logs/',
        body: {data: []},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/',
        body: [],
      });

      render(<TraceView />, {initialRouterConfig});

      const root = await screen.findByText('root transaction');
      expect(screen.queryByText('special span')).not.toBeInTheDocument();
      await userEvent.click(root);
      await userEvent.keyboard('{arrowright}');
      expect(await screen.findByText('special span')).toBeInTheDocument();
      await userEvent.keyboard('{arrowleft}');
      await waitFor(() => {
        expect(screen.queryByText('special span')).not.toBeInTheDocument();
      });
    });
  });
});
