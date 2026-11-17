// create a basic test for filters bar

import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {TagsFixture} from 'sentry-fixture/tags';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';
import {WEB_VITALS_NAVIGATION_TYPE_FEATURE} from 'sentry/views/insights/browser/webVitals/navigationType/settings';

import {enqueueDashboardWrite} from './hooks/useDashboardQueryPriority';
import {PrebuiltDashboardId} from './utils/prebuiltConfigs';
import {WEB_VITALS_NAVIGATION_TYPE_FILTER} from './utils/prebuiltConfigs/webVitals/webVitals';
import {FiltersBar, type FiltersBarProps} from './filtersBar';
import {DashboardFilterKeys, WidgetType, type GlobalFilter} from './types';

describe('FiltersBar', () => {
  let organization: Organization;

  beforeEach(() => {
    mockNetworkRequests();

    organization = OrganizationFixture();
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  const renderFilterBar = (overrides: Partial<FiltersBarProps> = {}) => {
    const props: FiltersBarProps = {
      filters: {},
      hasUnsavedChanges: false,
      isEditingDashboard: false,
      isPreview: false,
      location: LocationFixture(),
      onDashboardFilterChange: () => {},
      ...overrides,
    };

    return render(<FiltersBar {...props} />, {organization});
  };

  describe('web vitals navigation type switcher', () => {
    // Like the insights route: `dashboard` is passed, `prebuiltDashboardId` isn't.
    function renderLikeInsightsRoute() {
      return renderFilterBar({
        dashboard: DashboardFixture([], {
          id: 'prebuilt-dashboard-6',
          prebuiltId: PrebuiltDashboardId.WEB_VITALS,
        }),
      });
    }

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/events/`,
        body: {data: [], meta: {fields: {}}},
      });
      // Value suggestions for the plain chip.
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/trace-items/attributes/browser.navigation.type/values/`,
        body: [],
      });
    });

    it('renders on the insights route when the flag is on', async () => {
      organization.features = [
        ...organization.features,
        WEB_VITALS_NAVIGATION_TYPE_FEATURE,
      ];

      renderLikeInsightsRoute();

      expect(
        await screen.findByRole('button', {name: /Measured on/})
      ).toBeInTheDocument();
    });

    it('stays off without the flag', () => {
      renderLikeInsightsRoute();

      expect(screen.queryByRole('button', {name: /Measured on/})).not.toBeInTheDocument();
    });

    it('replaces the plain chip on a dashboard duplicated from web vitals', async () => {
      organization.features = [
        ...organization.features,
        WEB_VITALS_NAVIGATION_TYPE_FEATURE,
      ];

      // A copy has no prebuilt ID, only the filter the config seeded.
      renderFilterBar({filters: {globalFilter: [WEB_VITALS_NAVIGATION_TYPE_FILTER]}});

      expect(
        await screen.findByRole('button', {name: /Measured on/})
      ).toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: /browser\.navigation\.type/})
      ).not.toBeInTheDocument();
    });

    it('keeps the plain chip for a value the switcher cannot represent', async () => {
      organization.features = [
        ...organization.features,
        WEB_VITALS_NAVIGATION_TYPE_FEATURE,
      ];

      renderFilterBar({
        filters: {
          globalFilter: [
            {
              ...WEB_VITALS_NAVIGATION_TYPE_FILTER,
              value: 'browser.navigation.type:[navigate]',
            },
          ],
        },
      });

      expect(
        await screen.findByRole('button', {name: /browser\.navigation\.type/})
      ).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: /Measured on/})).not.toBeInTheDocument();
    });
  });

  it('should render basic global filter', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: 'browser.name:[Chrome]',
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({location: newLocation});
    expect(
      await screen.findByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
  });

  it('shows the dataset for filters on the same key in different datasets', async () => {
    renderFilterBar({
      filters: {
        globalFilter: [
          {
            dataset: WidgetType.SPANS,
            tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
            value: 'browser.name:[Chrome]',
          },
          {
            dataset: WidgetType.LOGS,
            tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
            value: 'browser.name:[Firefox]',
          },
          {
            dataset: WidgetType.SPANS,
            tag: {key: 'os.name', name: 'OS Name', kind: FieldKind.FIELD},
            value: 'os.name:[Linux]',
          },
        ],
      },
    });

    expect(
      await screen.findByRole('button', {name: /^Spans.*browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: /^Logs.*browser\.name.*Firefox/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /^os\.name.*Linux/i})).toBeInTheDocument();
  });

  it('shows the dataset in a tooltip on the filter trigger', async () => {
    renderFilterBar({
      filters: {
        globalFilter: [
          {
            dataset: WidgetType.SPANS,
            tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
            value: 'browser.name:[Chrome]',
          },
        ],
      },
    });

    const trigger = await screen.findByRole('button', {name: /^browser\.name.*Chrome/i});
    await userEvent.hover(trigger);
    expect(await screen.findByText('Spans Filter')).toBeInTheDocument();
  });

  it.each([
    ['Logs', 'logs'],
    ['Spans', 'spans'],
    ['Application Metrics', 'tracemetrics'],
  ])('dynamically fetches %s filter keys when searched', async (dataset, itemType) => {
    organization = OrganizationFixture({
      features: ['ourlogs-enabled', 'visibility-explore-view'],
    });
    const filterKey = `custom.searched.${itemType}`;
    const searchRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [
        {
          attributeSource: {source_type: 'user'},
          attributeType: 'string',
          key: filterKey,
          name: filterKey,
        },
      ],
      match: [(_url, options) => Boolean(options.query?.substringMatch)],
    });

    renderFilterBar();
    await userEvent.click(screen.getByRole('button', {name: 'Add Global Filter'}));
    await userEvent.click(screen.getByRole('option', {name: dataset}));
    await userEvent.type(screen.getByRole('searchbox'), 'searched');

    await waitFor(() =>
      expect(searchRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/trace-items/attributes/',
        expect.objectContaining({
          query: expect.objectContaining({itemType, substringMatch: 'searched'}),
        })
      )
    );
    expect(await screen.findByRole('option', {name: filterKey})).toBeInTheDocument();
  });

  it('should render save button with unsaved changes', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: 'browser.name:[Chrome]',
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({location: newLocation, hasUnsavedChanges: true});
    expect(await screen.findByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('should not render save button with temporary filter', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: 'browser.name:[Chrome]',
          isTemporary: true,
        } satisfies GlobalFilter),
      },
    });

    renderFilterBar({location: newLocation});
    expect(
      await screen.findByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('should sync merged filters to URL on mount', async () => {
    const savedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'os.name', name: 'OS Name', kind: FieldKind.FIELD},
      value: 'os.name:[Windows]',
    };
    const urlFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
      value: 'browser.name:[Chrome]',
    };
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify(urlFilter),
      },
    });

    const onDashboardFilterChange = jest.fn();
    renderFilterBar({
      location: newLocation,
      filters: {
        [DashboardFilterKeys.GLOBAL_FILTER]: [savedFilter],
      },
      onDashboardFilterChange,
    });

    // Should call onDashboardFilterChange on mount with merged filters
    await waitFor(() => {
      expect(onDashboardFilterChange).toHaveBeenCalledWith({
        [DashboardFilterKeys.RELEASE]: [],
        [DashboardFilterKeys.GLOBAL_FILTER]: [savedFilter, urlFilter],
      });
    });
  });

  it('should sync merged filters on external global filter url change', async () => {
    const savedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'os.name', name: 'OS Name', kind: FieldKind.FIELD},
      value: 'os.name:[Windows]',
    };
    const urlFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
      value: 'browser.name:[Chrome]',
    };

    // Render with only the saved filter — no URL filter yet
    const onDashboardFilterChange = jest.fn();
    const {rerender} = renderFilterBar({
      location: LocationFixture(),
      filters: {
        [DashboardFilterKeys.GLOBAL_FILTER]: [savedFilter],
      },
      onDashboardFilterChange,
    });

    // Only the saved filter should be visible initially
    expect(
      await screen.findByRole('button', {name: /os\.name.*Windows/i})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: /browser\.name.*Chrome/i})
    ).not.toBeInTheDocument();

    // Simulate an external component (e.g. AgentTags) pushing a new filter into the URL
    rerender(
      <FiltersBar
        location={LocationFixture({
          query: {[DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify(urlFilter)},
        })}
        filters={{[DashboardFilterKeys.GLOBAL_FILTER]: [savedFilter]}}
        hasUnsavedChanges={false}
        isEditingDashboard={false}
        isPreview={false}
        onDashboardFilterChange={onDashboardFilterChange}
      />
    );

    // Both filters should now be visible — the new URL filter was merged in
    expect(
      await screen.findByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: /os\.name.*Windows/i})).toBeInTheDocument();
  });

  it('should not sync filters to URL when no saved filters to merge', async () => {
    const urlFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
      value: 'browser.name:[Chrome]',
    };
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify(urlFilter),
      },
    });

    const onDashboardFilterChange = jest.fn();
    renderFilterBar({
      location: newLocation,
      onDashboardFilterChange,
    });

    // Wait for any effects to settle
    await waitFor(() => {
      expect(
        screen.getByRole('button', {name: /browser\.name.*Chrome/i})
      ).toBeInTheDocument();
    });

    expect(onDashboardFilterChange).not.toHaveBeenCalled();
  });

  it('should not restore saved filters when URL filters are explicitly cleared', async () => {
    const savedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'os.name', name: 'OS Name', kind: FieldKind.FIELD},
      value: 'os.name:[Windows]',
    };
    // Empty string simulates cleared filters (handleChangeFilter stores [''])
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: '',
      },
    });

    const onDashboardFilterChange = jest.fn();
    renderFilterBar({
      location: newLocation,
      filters: {
        [DashboardFilterKeys.GLOBAL_FILTER]: [savedFilter],
      },
      onDashboardFilterChange,
    });

    // Wait for component to fully render
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'All Releases'})).toBeInTheDocument();
    });

    // Should NOT call onDashboardFilterChange — user cleared filters intentionally
    expect(onDashboardFilterChange).not.toHaveBeenCalled();
  });

  it('should render save and cancel buttons on prebuilt dashboard with unsaved changes', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: 'browser.name:[Chrome]',
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({
      location: newLocation,
      hasUnsavedChanges: true,
      prebuiltDashboardId: PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
    });
    expect(
      await screen.findByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save for Everyone'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  describe('query priority', () => {
    it('hides the control when the feature is off', () => {
      renderFilterBar();

      expect(
        screen.queryByRole('button', {name: 'Query Speed: Balanced Querying'})
      ).not.toBeInTheDocument();
    });

    it('defaults to normal and can switch to faster', async () => {
      organization = OrganizationFixture({
        features: ['low-priority-queries'],
      });
      renderFilterBar();

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      expect(screen.getByText('Balances speed and accuracy')).toBeInTheDocument();
      expect(screen.getByText('Faster with reduced accuracy')).toBeInTheDocument();

      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));

      expect(
        screen.getByRole('button', {name: 'Query Speed: Fast Querying'})
      ).toBeInTheDocument();
    });

    it('shows the priority saved on the dashboard', () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      renderFilterBar({
        dashboard: DashboardFixture([], {queryPriority: 'faster'}),
      });

      expect(
        screen.getByRole('button', {name: 'Query Speed: Fast Querying'})
      ).toBeInTheDocument();
    });

    it('saves the selection on the dashboard', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {queryPriority: 'faster'}),
      });
      renderFilterBar({
        dashboard: DashboardFixture([], {id: '1'}),
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          '/organizations/org-slug/dashboards/1/',
          expect.objectContaining({
            method: 'PUT',
            data: {queryPriority: 'faster'},
          })
        );
      });
    });

    it('does not save a prebuilt placeholder dashboard', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/prebuilt-dashboard-1/',
        method: 'PUT',
      });
      renderFilterBar({
        dashboard: DashboardFixture([], {id: 'prebuilt-dashboard-1'}),
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));

      expect(
        screen.getByRole('button', {name: 'Query Speed: Fast Querying'})
      ).toBeInTheDocument();
      expect(updateMock).not.toHaveBeenCalled();
    });

    it('saves the latest selection when the priority changes during a save', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      let releaseFirstSave = () => {};
      const firstSave = new Promise<void>(resolve => {
        releaseFirstSave = resolve;
      });
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {queryPriority: 'normal'}),
        asyncDelay: firstSave,
      });
      renderFilterBar({
        dashboard: DashboardFixture([], {id: '1', queryPriority: 'normal'}),
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));
      expect(updateMock).toHaveBeenCalledTimes(1);

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Fast Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Balanced Querying'}));
      expect(updateMock).toHaveBeenCalledTimes(1);

      releaseFirstSave();

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledTimes(2);
      });
      expect(updateMock).toHaveBeenNthCalledWith(
        1,
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          method: 'PUT',
          data: {queryPriority: 'faster'},
        })
      );
      expect(updateMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          method: 'PUT',
          data: {queryPriority: 'normal'},
        })
      );
      expect(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      ).toBeInTheDocument();
    });

    it('saves a revert after the previous save settles and before props update', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      let releaseSave = () => {};
      const saveSettled = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      const onDashboardQueryPrioritySaved = jest.fn();
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {queryPriority: 'faster'}),
        asyncDelay: saveSettled,
      });
      renderFilterBar({
        dashboard: DashboardFixture([], {id: '1', queryPriority: 'normal'}),
        onDashboardQueryPrioritySaved,
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));
      expect(updateMock).toHaveBeenCalledTimes(1);

      releaseSave();
      await waitFor(() => {
        expect(onDashboardQueryPrioritySaved).toHaveBeenCalled();
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Fast Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Balanced Querying'}));

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledTimes(2);
      });
      expect(updateMock).toHaveBeenNthCalledWith(
        2,
        '/organizations/org-slug/dashboards/1/',
        expect.objectContaining({
          method: 'PUT',
          data: {queryPriority: 'normal'},
        })
      );
    });

    it('does not apply a priority save after the bar unmounts', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      let releaseSave = () => {};
      const saveSettled = new Promise<void>(resolve => {
        releaseSave = resolve;
      });
      const onDashboardQueryPrioritySaved = jest.fn();
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {queryPriority: 'faster'}),
        asyncDelay: saveSettled,
      });
      const {unmount} = renderFilterBar({
        dashboard: DashboardFixture([], {id: '1', queryPriority: 'normal'}),
        onDashboardQueryPrioritySaved,
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));
      expect(updateMock).toHaveBeenCalledTimes(1);

      unmount();
      releaseSave();
      await act(async () => {
        await saveSettled;
      });

      expect(onDashboardQueryPrioritySaved).not.toHaveBeenCalled();
    });

    it('persists a queued priority save after the bar unmounts', async () => {
      organization = OrganizationFixture({
        features: ['dashboards-basic', 'dashboards-edit', 'low-priority-queries'],
      });
      let releaseBlocker = () => {};
      const blocker = new Promise<void>(resolve => {
        releaseBlocker = resolve;
      });
      const blockedWrite = enqueueDashboardWrite(() => blocker);
      const onDashboardQueryPrioritySaved = jest.fn();
      const updateMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/dashboards/1/',
        method: 'PUT',
        body: DashboardFixture([], {queryPriority: 'faster'}),
      });
      const {unmount} = renderFilterBar({
        dashboard: DashboardFixture([], {id: '1', queryPriority: 'normal'}),
        onDashboardQueryPrioritySaved,
      });

      await userEvent.click(
        screen.getByRole('button', {name: 'Query Speed: Balanced Querying'})
      );
      await userEvent.click(screen.getByRole('option', {name: 'Fast Querying'}));
      expect(updateMock).not.toHaveBeenCalled();

      unmount();
      releaseBlocker();
      await blockedWrite;

      await waitFor(() => {
        expect(updateMock).toHaveBeenCalledWith(
          '/organizations/org-slug/dashboards/1/',
          expect.objectContaining({
            method: 'PUT',
            data: {queryPriority: 'faster'},
          })
        );
      });
      expect(onDashboardQueryPrioritySaved).not.toHaveBeenCalled();
    });
  });
});

const mockNetworkRequests = () => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/members/',
    body: [],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/',
    body: [ReleaseFixture()],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    body: TagsFixture(),
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/measurements-meta/',
    body: {
      'measurements.custom.measurement': {
        functions: ['p99'],
      },
      'measurements.another.custom.measurement': {
        functions: ['p99'],
      },
    },
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body: [],
    match: [(_url, options) => !options.query?.substringMatch],
  });

  const mockSearchResponse = [
    {
      key: 'browser.name',
      value: 'Chrome',
      name: 'Chrome',
      first_seen: null,
      last_seen: null,
      times_seen: null,
    },
    {
      key: 'browser.name',
      value: 'Firefox',
      name: 'Firefox',
      first_seen: null,
      last_seen: null,
      times_seen: null,
    },
  ];

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/browser.name/values/',
    body: mockSearchResponse,
    match: [MockApiClient.matchQuery({attributeType: 'string'})],
  });

  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/os.name/values/',
    body: [
      {
        key: 'os.name',
        value: 'Windows',
        name: 'Windows',
        first_seen: null,
        last_seen: null,
        times_seen: null,
      },
    ],
    match: [MockApiClient.matchQuery({attributeType: 'string'})],
  });
};
