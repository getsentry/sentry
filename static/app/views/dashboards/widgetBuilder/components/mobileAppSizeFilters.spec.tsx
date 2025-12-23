import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {Organization} from 'sentry/types/organization';
import {MobileAppSizeFilters} from 'sentry/views/dashboards/widgetBuilder/components/mobileAppSizeFilters';
import {WidgetBuilderProvider} from 'sentry/views/dashboards/widgetBuilder/contexts/widgetBuilderContext';

describe('MobileAppSizeFilters', () => {
  let organization: Organization;
  let mockApiRequest: jest.Mock;

  beforeEach(() => {
    organization = OrganizationFixture();
    MockApiClient.clearMockResponses();

    // Mock the app-size-stats endpoint that provides filter options
    mockApiRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprod/app-size-stats/`,
      body: {
        filters: {
          app_ids: ['com.example.app1', 'com.example.app2', 'com.example.app3'],
          branches: ['main', 'develop', 'feature/test'],
          build_configs: ['Release', 'Debug', 'Profile'],
        },
      },
    });
  });

  const renderComponent = (initialRouterConfig = {}) => {
    return render(
      <WidgetBuilderProvider>
        <MobileAppSizeFilters />
      </WidgetBuilderProvider>,
      {
        organization,
        initialRouterConfig,
      }
    );
  };

  it('renders loading state initially', () => {
    renderComponent();
    expect(screen.getByText('Loading filter options...')).toBeInTheDocument();
  });

  it('fetches and displays filter options', async () => {
    renderComponent();

    await waitFor(() => {
      expect(mockApiRequest).toHaveBeenCalledWith(
        `/organizations/${organization.slug}/preprod/app-size-stats/`,
        expect.objectContaining({
          query: {includeFilters: 'true', statsPeriod: '90d'},
        })
      );
    });

    // Should show the Size Analysis documentation link
    expect(await screen.findByText('Size Analysis documentation')).toBeInTheDocument();

    // Should show filter section
    expect(screen.getByText('Filter')).toBeInTheDocument();
    expect(screen.getByText('Query 1')).toBeInTheDocument();
  });

  it('allows adding additional queries', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Query 1')).toBeInTheDocument();
    });

    const addQueryButton = screen.getByRole('button', {name: 'Add Query'});
    await userEvent.click(addQueryButton);

    // Should now show Query 2
    expect(screen.getByText('Query 2')).toBeInTheDocument();
  });

  it('allows removing queries when multiple exist', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Query 1')).toBeInTheDocument();
    });

    // Add a second query
    const addQueryButton = screen.getByRole('button', {name: 'Add Query'});
    await userEvent.click(addQueryButton);

    expect(screen.getByText('Query 2')).toBeInTheDocument();

    // Remove button should be visible now
    const removeButtons = screen.getAllByRole('button', {name: 'Remove query'});
    expect(removeButtons).toHaveLength(2);

    // Click the first remove button
    await userEvent.click(removeButtons[0]!);

    // Should only have Query 1 left (renumbered from Query 2)
    expect(screen.getByText('Query 1')).toBeInTheDocument();
    expect(screen.queryByText('Query 2')).not.toBeInTheDocument();
  });

  it('handles empty filter response gracefully', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/preprod/app-size-stats/`,
      body: {
        filters: {
          app_ids: [],
          branches: [],
          build_configs: [],
        },
      },
    });

    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    // Should render without errors even with empty filter options
    expect(screen.getByText('Query 1')).toBeInTheDocument();
  });
});
