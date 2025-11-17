import {render, screen, userEvent, waitFor, within} from 'sentry-test/reactTestingLibrary';

import BreadcrumbsDataSection from 'sentry/components/events/breadcrumbs/breadcrumbsDataSection';
import {
  MOCK_BREADCRUMBS,
  MOCK_DATA_SECTION_PROPS,
} from 'sentry/components/events/breadcrumbs/testUtils';
import * as indicators from 'sentry/actionCreators/indicator';
import * as analytics from 'sentry/utils/analytics';

// Mock the indicators
jest.mock('sentry/actionCreators/indicator');
const mockAddSuccessMessage = jest.mocked(indicators.addSuccessMessage);
const mockAddErrorMessage = jest.mocked(indicators.addErrorMessage);

// Mock analytics
jest.mock('sentry/utils/analytics');
const mockTrackAnalytics = jest.mocked(analytics.trackAnalytics);

async function renderBreadcrumbDrawer() {
  // Needed to mock useVirtualizer lists.
  jest
    .spyOn(window.Element.prototype, 'getBoundingClientRect')
    .mockImplementation(() => ({
      x: 0,
      y: 0,
      width: 0,
      height: 30,
      left: 0,
      top: 0,
      right: 0,
      bottom: 0,
      toJSON: jest.fn(),
    }));
  render(<BreadcrumbsDataSection {...MOCK_DATA_SECTION_PROPS} />);
  await userEvent.click(screen.getByRole('button', {name: 'View All Breadcrumbs'}));
  return screen.getByRole('complementary', {name: 'breadcrumb drawer'});
}

describe('BreadcrumbsDrawer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders the drawer as expected', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Close Drawer'})
    ).toBeInTheDocument();

    // Inner drawer breadcrumbs
    const {event, group} = MOCK_DATA_SECTION_PROPS;
    expect(within(drawerScreen).getByText(group.shortId)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(event.id.slice(0, 8))).toBeInTheDocument();
    expect(
      within(drawerScreen).getByText('Breadcrumbs', {selector: 'span'})
    ).toBeInTheDocument();

    // Header & Controls
    expect(
      within(drawerScreen).getByText('Breadcrumbs', {selector: 'h3'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('textbox', {name: 'Search All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Sort All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    ).toBeInTheDocument();
    expect(
      within(drawerScreen).getByRole('button', {
        name: 'Change Time Format for All Breadcrumbs',
      })
    ).toBeInTheDocument();

    // Contents
    for (const {category, level, message} of MOCK_BREADCRUMBS) {
      expect(within(drawerScreen).getByText(category)).toBeInTheDocument();
      expect(within(drawerScreen).getByText(level)).toBeInTheDocument();
      expect(within(drawerScreen).getByText(message)).toBeInTheDocument();
    }
    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
  });

  it('allows search to affect displayed crumbs', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;
    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(logCrumb.category)).toBeInTheDocument();

    const searchInput = within(drawerScreen).getByRole('textbox', {
      name: 'Search All Breadcrumbs',
    });
    await userEvent.type(searchInput, warningCrumb.message);

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows type filter to affect displayed crumbs', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();

    const queryCrumb = MOCK_BREADCRUMBS[3];
    const requestCrumb = MOCK_BREADCRUMBS[2];
    expect(within(drawerScreen).getByText(queryCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(requestCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Query'}));

    expect(within(drawerScreen).getByText(queryCrumb.category)).toBeInTheDocument();
    expect(
      within(drawerScreen).queryByText(requestCrumb.category)
    ).not.toBeInTheDocument();
  });

  it('allows level spofilter to affect displayed crumbs', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).getByText(logCrumb.category)).toBeInTheDocument();

    await userEvent.click(
      within(drawerScreen).getByRole('button', {name: 'Filter All Breadcrumbs'})
    );
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'warning'}));

    expect(within(drawerScreen).getByText(warningCrumb.category)).toBeInTheDocument();
    expect(within(drawerScreen).queryByText(logCrumb.category)).not.toBeInTheDocument();
  });

  it('allows sort dropdown to affect displayed crumbs', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();

    const [warningCrumb, logCrumb] = MOCK_BREADCRUMBS;

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);

    const sortControl = within(drawerScreen).getByRole('button', {
      name: 'Sort All Breadcrumbs',
    });
    await userEvent.click(sortControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Oldest'}));

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_FOLLOWING);

    await userEvent.click(sortControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Newest'}));

    expect(
      within(drawerScreen)
        .getByText(warningCrumb.category)
        .compareDocumentPosition(within(drawerScreen).getByText(logCrumb.category))
    ).toBe(document.DOCUMENT_POSITION_PRECEDING);
  });

  it('allows time display dropdown to change all displayed crumbs', async () => {
    const drawerScreen = await renderBreadcrumbDrawer();
    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
    const timeControl = within(drawerScreen).getByRole('button', {
      name: 'Change Time Format for All Breadcrumbs',
    });
    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Relative'}));

    expect(within(drawerScreen).queryByText('06:00:48.760 PM')).not.toBeInTheDocument();
    expect(within(drawerScreen).getAllByText('-1min 2ms')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );

    await userEvent.click(timeControl);
    await userEvent.click(within(drawerScreen).getByRole('option', {name: 'Absolute'}));

    expect(within(drawerScreen).getAllByText('06:00:48.760 PM')).toHaveLength(
      MOCK_BREADCRUMBS.length
    );
    expect(within(drawerScreen).queryByText('-1min 2ms')).not.toBeInTheDocument();
  });

  describe('Copy All Breadcrumbs Functionality', () => {
    const mockWriteText = jest.fn();
    const mockExecCommand = jest.fn();

    beforeEach(() => {
      jest.clearAllMocks();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: mockWriteText,
        },
      });
      
      // Mock execCommand for fallback
      Object.defineProperty(document, 'execCommand', {
        value: mockExecCommand,
        writable: true,
      });
      
      // Mock secure context
      Object.defineProperty(window, 'isSecureContext', {
        value: true,
        writable: true,
      });
      
      mockWriteText.mockResolvedValue(undefined);
      mockExecCommand.mockReturnValue(true);
    });

    it('renders copy button with correct accessibility attributes', async () => {
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      expect(copyButton).toBeInTheDocument();
      expect(copyButton).toHaveAttribute('title', 'Copy all visible breadcrumbs to clipboard');
      expect(copyButton).toHaveAttribute('aria-label', 'Copy All Breadcrumbs');
    });

    it('copies all visible breadcrumbs to clipboard using modern API', async () => {
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
      });
      
      const copiedText = mockWriteText.mock.calls[0][0];
      expect(copiedText).toContain('BREADCRUMBS');
      expect(copiedText).toContain('Warning Category');
      expect(copiedText).toContain('Log Category');
      expect(copiedText).toContain('Total:');
      
      expect(mockAddSuccessMessage).toHaveBeenCalledWith(
        expect.stringContaining('Copied')
      );
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('breadcrumbs.drawer.copy_all', {
        organization: {slug: 'org-slug'},
        count: expect.any(Number),
        timeDisplay: 'absolute',
        hasFilters: false,
        hasSearch: false,
      });
    });

    it('falls back to execCommand when clipboard API is not available', async () => {
      // Mock clipboard API as unavailable
      Object.assign(navigator, {
        clipboard: undefined,
      });
      
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockExecCommand).toHaveBeenCalledWith('copy');
      });
      
      expect(mockAddSuccessMessage).toHaveBeenCalled();
    });

    it('handles copy failure gracefully', async () => {
      mockWriteText.mockRejectedValue(new Error('Copy failed'));
      
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockAddErrorMessage).toHaveBeenCalledWith(
          'Failed to copy breadcrumbs to clipboard'
        );
      });
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('breadcrumbs.drawer.copy_all_failed', {
        organization: {slug: 'org-slug'},
        count: expect.any(Number),
      });
    });

    it('disables copy button when no breadcrumbs are visible', async () => {
      const drawerScreen = await renderBreadcrumbDrawer();
      
      // Filter out all breadcrumbs
      const searchInput = within(drawerScreen).getByRole('textbox', {name: 'Search All Breadcrumbs'});
      await userEvent.type(searchInput, 'nonexistent-breadcrumb-filter');
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      expect(copyButton).toBeDisabled();
    });

    it('only copies filtered breadcrumbs when search is applied', async () => {
      const drawerScreen = await renderBreadcrumbDrawer();
      
      // Apply a search filter for warning
      const searchInput = within(drawerScreen).getByRole('textbox', {name: 'Search All Breadcrumbs'});
      await userEvent.type(searchInput, 'warning');
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
      });
      
      const copiedText = mockWriteText.mock.calls[0][0];
      expect(copiedText).toContain('Warning Category');
      expect(copiedText).not.toContain('Log Category');
      
      expect(mockTrackAnalytics).toHaveBeenCalledWith('breadcrumbs.drawer.copy_all', {
        organization: {slug: 'org-slug'},
        count: expect.any(Number),
        timeDisplay: 'absolute',
        hasFilters: false,
        hasSearch: true,
      });
    });

    it('shows loading state while copying', async () => {
      // Make writeText take time to resolve
      mockWriteText.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));
      
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      // Should show loading text and disable button
      expect(within(drawerScreen).getByText('Copying...')).toBeInTheDocument();
      expect(copyButton).toBeDisabled();
      
      // Wait for copy to complete
      await waitFor(() => {
        expect(mockAddSuccessMessage).toHaveBeenCalled();
      });
      
      // Should no longer show loading text
      expect(within(drawerScreen).queryByText('Copying...')).not.toBeInTheDocument();
    });

    it('formats output correctly with proper structure', async () => {
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      await waitFor(() => {
        expect(mockWriteText).toHaveBeenCalledTimes(1);
      });
      
      const copiedText = mockWriteText.mock.calls[0][0];
      
      // Check structure
      expect(copiedText).toContain('BREADCRUMBS');
      expect(copiedText).toContain('='.repeat(50));
      expect(copiedText).toMatch(/\d+\. .*\[\w+\] .*Category/); // Numbered format
      expect(copiedText).toContain('Total:');
      
      // Check that timestamps are included
      expect(copiedText).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    });

    it('handles non-secure context gracefully', async () => {
      // Mock non-secure context (clipboard API should still work but test fallback path)
      Object.defineProperty(window, 'isSecureContext', {
        value: false,
        writable: true,
      });
      
      const drawerScreen = await renderBreadcrumbDrawer();
      
      const copyButton = within(drawerScreen).getByRole('button', {name: 'Copy All Breadcrumbs'});
      await userEvent.click(copyButton);
      
      // Should fall back to execCommand
      await waitFor(() => {
        expect(mockExecCommand).toHaveBeenCalledWith('copy');
      });
    });
  });
});