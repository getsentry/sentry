import {AppleInsightResultsFixture} from 'sentry-fixture/preProdAppSize';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';

import {AppSizeInsights} from './appSizeInsights';

describe('AppSizeInsights', () => {
  const getDefaultProps = () => {
    const totalSize = 10240000;
    const insights = AppleInsightResultsFixture();
    return {
      processedInsights: processInsights(insights, totalSize),
      totalSize,
    };
  };

  it('renders the main insights container with correct header', () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    expect(screen.getByText('Top insights')).toBeInTheDocument();
    expect(screen.getByText('View all insights')).toBeInTheDocument();
  });

  it('displays only top 3 insights in the main view', () => {
    const manyInsights = AppleInsightResultsFixture({
      unnecessary_files: {
        total_savings: 128000,
        files: [{file_path: 'temp.log', total_savings: 128000}],
      },
      small_files: {
        total_savings: 64000,
        files: [{file_path: 'tiny.txt', total_savings: 64000}],
      },
    });

    const totalSize = 10240000;
    render(
      <AppSizeInsights processedInsights={processInsights(manyInsights, totalSize)} />
    );

    // Should show top 3 insights in main view
    expect(screen.getByText('Remove duplicate files')).toBeInTheDocument();
    expect(screen.getByText('Compress large images')).toBeInTheDocument();
    expect(screen.getByText('Compress large videos')).toBeInTheDocument();

    // Should NOT show lower priority insights in main view
    expect(screen.queryByText('Unnecessary files')).not.toBeInTheDocument();
    expect(screen.queryByText('Small files')).not.toBeInTheDocument();
  });

  it('formats file sizes and percentages correctly', () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    // Check formatted file sizes (using formatBytesBase10)
    expect(screen.getByText(/-\s*768\s*KB/i)).toBeInTheDocument(); // duplicate_files
    expect(screen.getByText(/-\s*512\s*KB/i)).toBeInTheDocument(); // large_images
    expect(screen.getByText(/-\s*256\s*KB/i)).toBeInTheDocument(); // large_videos

    // Check formatted percentages
    expect(screen.getByText('(-7.5%)')).toBeInTheDocument(); // 768000/10240000
    expect(screen.getByText('(-5%)')).toBeInTheDocument(); // 512000/10240000
    expect(screen.getByText('(-2.5%)')).toBeInTheDocument(); // 256000/10240000
  });

  it('opens sidebar when "View all insights" button is clicked', async () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    // Initially sidebar should not be visible
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();

    // Click "View all insights" button
    const viewAllButton = screen.getByText('View all insights');
    await userEvent.click(viewAllButton);

    // Sidebar should now be visible
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
  });

  it('closes sidebar when sidebar onClose is called', async () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    // Open sidebar
    const viewAllButton = screen.getByText('View all insights');
    await userEvent.click(viewAllButton);
    expect(screen.getByText('Insights')).toBeInTheDocument();

    // Close sidebar
    const closeButton = screen.getByLabelText('Close sidebar');
    await userEvent.click(closeButton);

    // Sidebar should be closed
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });
});
