// create a basic test for filters bar

import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  render,
  screen,
  waitFor,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {FieldKind} from 'sentry/utils/fields';
import FiltersBar, {type FiltersBarProps} from 'sentry/views/dashboards/filtersBar';
import {
  DashboardFilterKeys,
  WidgetType,
  type GlobalFilter,
} from 'sentry/views/dashboards/types';
import {PrebuiltDashboardId} from 'sentry/views/dashboards/utils/prebuiltConfigs';

describe('FiltersBar', () => {
  let organization: Organization;

  beforeEach(() => {
    mockNetworkRequests();

    organization = OrganizationFixture({
      features: ['dashboards-basic', 'dashboards-edit'],
    });
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

  it('should render basic global filter', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: `browser.name:[Chrome]`,
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({location: newLocation});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(
      screen.getByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
  });

  it('should render save button with unsaved changes', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: `browser.name:[Chrome]`,
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({location: newLocation, hasUnsavedChanges: true});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });

  it('should not render save button with temporary filter', async () => {
    const newLocation = LocationFixture({
      query: {
        [DashboardFilterKeys.GLOBAL_FILTER]: JSON.stringify({
          dataset: WidgetType.SPANS,
          tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
          value: `browser.name:[Chrome]`,
          isTemporary: true,
        } satisfies GlobalFilter),
      },
    });

    renderFilterBar({location: newLocation});
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(
      screen.getByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
  });

  it('should sync merged filters to URL on mount', async () => {
    const savedFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'os.name', name: 'OS Name', kind: FieldKind.FIELD},
      value: `os.name:[Windows]`,
    };
    const urlFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
      value: `browser.name:[Chrome]`,
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

  it('should not sync filters to URL when no saved filters to merge', async () => {
    const urlFilter: GlobalFilter = {
      dataset: WidgetType.SPANS,
      tag: {key: 'browser.name', name: 'Browser Name', kind: FieldKind.FIELD},
      value: `browser.name:[Chrome]`,
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
      value: `os.name:[Windows]`,
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
          value: `browser.name:[Chrome]`,
        } satisfies GlobalFilter),
      },
    });
    renderFilterBar({
      location: newLocation,
      hasUnsavedChanges: true,
      prebuiltDashboardId: PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(
      screen.getByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Save'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
  });
});

const mockNetworkRequests = () => {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/releases/',
    body: [ReleaseFixture()],
  });
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/tags/',
    body: TagsFixture(),
  });
  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/measurements-meta/`,
    body: {
      'measurements.custom.measurement': {
        functions: ['p99'],
      },
      'measurements.another.custom.measurement': {
        functions: ['p99'],
      },
    },
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
    url: `/organizations/org-slug/trace-items/attributes/browser.name/values/`,
    body: mockSearchResponse,
    match: [MockApiClient.matchQuery({attributeType: 'string'})],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/org-slug/trace-items/attributes/os.name/values/`,
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
