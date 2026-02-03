import {InsightResultsFixture} from 'sentry-fixture/preProdAppSize';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';

import {AppSizeInsights} from './appSizeInsights';

describe('AppSizeInsights', () => {
  const getDefaultProps = () => {
    const totalSize = 10240000;
    const insights = InsightResultsFixture();
    return {
      processedInsights: processInsights(insights, totalSize),
      totalSize,
    };
  };

  it('renders the main insights container with correct header', () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    expect(screen.getByText('Top insights')).toBeInTheDocument();
    expect(screen.getByText('View insight details')).toBeInTheDocument();
  });

  it('displays only top 5 insights in the main view', () => {
    const manyInsights = InsightResultsFixture({
      image_optimization: {
        total_savings: 600000,
        optimizable_files: [
          {
            file_path: 'icon.png',
            current_size: 800000,
            minify_savings: 300000,
            minified_size: 500000,
            conversion_savings: 300000,
            heic_size: 500000,
            colorspace: null,
            idiom: null,
          },
        ],
      },
      strip_binary: {
        total_savings: 400000,
        total_debug_sections_savings: 250000,
        total_symbol_table_savings: 150000,
        files: [
          {
            file_path: 'app.binary',
            total_savings: 400000,
            debug_sections_savings: 250000,
            symbol_table_savings: 150000,
          },
        ],
      },
      // These should be outside the top 5 (6th and 7th)
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

    expect(screen.getByText('Duplicate Files')).toBeInTheDocument();
    expect(screen.getByText('Image Optimization')).toBeInTheDocument();
    expect(screen.getByText('Large Images')).toBeInTheDocument();
    expect(screen.getByText('Strip Binary Symbols')).toBeInTheDocument();
    expect(screen.getByText('Large Videos')).toBeInTheDocument();

    // Should NOT show lower priority insights in main view (6th and 7th)
    expect(screen.queryByText('Unnecessary Files')).not.toBeInTheDocument();
    expect(screen.queryByText('Small Files')).not.toBeInTheDocument();
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
    const viewAllButton = screen.getByText('View insight details');
    await userEvent.click(viewAllButton);

    // Sidebar should now be visible
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
  });

  it('closes sidebar when sidebar onClose is called', async () => {
    render(<AppSizeInsights {...getDefaultProps()} />);

    // Open sidebar
    const viewAllButton = screen.getByText('View insight details');
    await userEvent.click(viewAllButton);
    expect(screen.getByText('Insights')).toBeInTheDocument();

    // Close sidebar
    const closeButton = screen.getByLabelText('Close sidebar');
    await userEvent.click(closeButton);

    // Sidebar should be closed
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });
});
