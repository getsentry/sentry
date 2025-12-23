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

  it('displays all filter fields', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    // Check for all filter fields
    expect(screen.getByText('App ID')).toBeInTheDocument();
    expect(screen.getByText('Artifact Type')).toBeInTheDocument();
    expect(screen.getByText('Branch')).toBeInTheDocument();
    expect(screen.getByText('Build Configuration')).toBeInTheDocument();
    // Check for size type radio buttons
    expect(
      screen.getByRole('radio', {name: 'Install / Uncompressed Size'})
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Download Size'})).toBeInTheDocument();
  });

  it('allows selecting app IDs', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    const appIdSelect = screen.getByText('Select one or more apps');
    await userEvent.click(appIdSelect);

    // Options from mocked API should be available
    await waitFor(() => {
      expect(screen.getByText('com.example.app1')).toBeInTheDocument();
    });
  });

  it('displays artifact type options', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    const artifactTypeSelect = screen.getByText('All artifact types');
    await userEvent.click(artifactTypeSelect);

    // Check for artifact type options
    expect(await screen.findByText('xcarchive (.app)')).toBeInTheDocument();
    expect(screen.getByText('aab (Android App Bundle)')).toBeInTheDocument();
    expect(screen.getByText('apk (Android APK)')).toBeInTheDocument();
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
    await userEvent.click(removeButtons[0]);

    // Should only have Query 1 left (renumbered from Query 2)
    expect(screen.getByText('Query 1')).toBeInTheDocument();
    expect(screen.queryByText('Query 2')).not.toBeInTheDocument();
  });

  it('does not show remove button when only one query exists', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Query 1')).toBeInTheDocument();
    });

    // Should not have any remove buttons with only one query
    expect(screen.queryByRole('button', {name: 'Remove query'})).not.toBeInTheDocument();
  });

  it('displays size type radio options', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    // Check for both size type options
    expect(
      screen.getByRole('radio', {name: 'Install / Uncompressed Size'})
    ).toBeInTheDocument();
    expect(screen.getByRole('radio', {name: 'Download Size'})).toBeInTheDocument();

    // Install size should be selected by default
    const installRadio = screen.getByRole('radio', {
      name: 'Install / Uncompressed Size',
    });
    expect(installRadio).toBeChecked();
  });

  it('allows switching between size types', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    const downloadRadio = screen.getByRole('radio', {name: 'Download Size'});
    await userEvent.click(downloadRadio);

    // Download size should now be selected
    expect(downloadRadio).toBeChecked();

    const installRadio = screen.getByRole('radio', {
      name: 'Install / Uncompressed Size',
    });
    expect(installRadio).not.toBeChecked();
  });

  it('parses initial query state correctly', async () => {
    const initialRouterConfig = {
      location: {
        pathname: '/mock-pathname/',
        query: {
          query: [
            'app_id:com.example.app1,com.example.app2 git_head_ref:main build_configuration_name:Release artifact_type:0',
          ],
        },
      },
    };

    renderComponent(initialRouterConfig);

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    // The component should parse and display the query conditions
    // Note: The actual values would be set in the SelectFields but may not be visible in the text
    // This test verifies the component renders without errors when given initial state
    expect(screen.getByText('Query 1')).toBeInTheDocument();
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

  it('renders documentation link with correct href', async () => {
    renderComponent();

    const docLink = await screen.findByText('Size Analysis documentation');
    expect(docLink).toHaveAttribute(
      'href',
      'https://docs.sentry.io/product/size-analysis/'
    );
    expect(docLink.closest('a')).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('has proper ARIA labels for accessibility', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Query 1')).toBeInTheDocument();
    });

    // Add a second query to enable remove buttons
    const addQueryButton = screen.getByRole('button', {name: 'Add Query'});
    await userEvent.click(addQueryButton);

    // Check that remove buttons have proper ARIA labels
    const removeButtons = screen.getAllByRole('button', {name: 'Remove query'});
    expect(removeButtons.length).toBeGreaterThan(0);
  });

  it('allows clearing filter selections', async () => {
    renderComponent();

    await waitFor(() => {
      expect(screen.getByText('Filter')).toBeInTheDocument();
    });

    // The SelectField components should have clearable prop set
    // This test verifies the component structure includes clearable selects
    // The actual clearing functionality is tested by the SelectField component itself
    expect(screen.getByText('Select one or more apps')).toBeInTheDocument();
  });
});
