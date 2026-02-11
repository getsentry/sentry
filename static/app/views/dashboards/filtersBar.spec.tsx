// create a basic test for filters bar

import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ReleaseFixture} from 'sentry-fixture/release';
import {TagsFixture} from 'sentry-fixture/tags';

import {render, screen, waitForElementToBeRemoved} from 'sentry-test/reactTestingLibrary';

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
      features: ['dashboards-basic', 'dashboards-edit', 'dashboards-global-filters'],
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

  it('should not render save button on prebuilt dashboard', async () => {
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
      prebuiltDashboardId: PrebuiltDashboardId.FRONTEND_SESSION_HEALTH,
    });
    await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));
    expect(
      screen.getByRole('button', {name: /browser\.name.*Chrome/i})
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Save'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Cancel'})).not.toBeInTheDocument();
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
};
