import {ProcessedInsightFixture} from 'sentry-fixture/preProdAppSize';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AppSizeInsightsSidebarRow} from './appSizeInsightsSidebarRow';

describe('AppSizeInsightsSidebarRow', () => {
  const getDefaultProps = () => ({
    insight: ProcessedInsightFixture(),
    isExpanded: false,
    onToggleExpanded: jest.fn(),
  });

  it('renders insight name and savings information', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.getByText('Duplicate files')).toBeInTheDocument();
    expect(
      screen.getByText('You have files that are duplicated across your app')
    ).toBeInTheDocument();
    expect(screen.getByText('Potential savings 1.02 MB')).toBeInTheDocument();
    expect(screen.getByText('15.5%')).toBeInTheDocument();
  });

  it('shows file count button', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('does not show files when collapsed', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} />);

    expect(screen.queryByText('src/components/Button.js')).not.toBeInTheDocument();
    expect(screen.queryByText('src/components/Icon.js')).not.toBeInTheDocument();
  });

  it('shows files when expanded', () => {
    render(<AppSizeInsightsSidebarRow {...getDefaultProps()} isExpanded />);

    expect(screen.getByText('src/components/Button.js')).toBeInTheDocument();
    expect(screen.getByText('src/components/Icon.js')).toBeInTheDocument();
    expect(screen.getByText('src/assets/logo.png')).toBeInTheDocument();

    // Check file savings are displayed with negative values
    expect(screen.getByText(/-\s*512\s*KB/i)).toBeInTheDocument();
    expect(screen.getByText(/-\s*256\s*KB/i)).toBeInTheDocument();
    // logo.png shows 128 KB in both main row and HEIC row
    expect(screen.getAllByText(/-\s*128\s*KB/i)).toHaveLength(2);
    expect(screen.getByText('(-7.5%)')).toBeInTheDocument();
    expect(screen.getByText('(-4%)')).toBeInTheDocument();
    // logo.png has (-2%) savings (main and HEIC)
    expect(screen.getAllByText('(-2%)')).toHaveLength(2);
  });

  it('calls onToggleExpanded when clicking the toggle button', async () => {
    const props = getDefaultProps();
    render(<AppSizeInsightsSidebarRow {...props} />);

    const toggleButton = screen.getByRole('button', {name: /3 files/i});
    await userEvent.click(toggleButton);

    expect(props.onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('shows both optimize and HEIC options for optimizable images', () => {
    const insightWithOptimizableImage = ProcessedInsightFixture({
      files: [
        {
          path: 'image.png',
          savings: 300000, // max of minify and conversion
          percentage: 10,
          data: {
            fileType: 'optimizable_image' as const,
            minifyPercentage: 6.67, // 200000 / 3000000 * 100
            conversionPercentage: 10, // 300000 / 3000000 * 100
            originalFile: {
              file_path: 'image.png',
              current_size: 1000000,
              minify_savings: 200000,
              minified_size: 800000,
              conversion_savings: 300000,
              heic_size: 700000,
            },
          },
        },
      ],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithOptimizableImage}
        isExpanded
      />
    );

    expect(screen.getByText('image.png')).toBeInTheDocument();

    // Should show max savings in main row (300 KB appears twice: main row + HEIC row)
    expect(screen.getAllByText(/-300\s*KB/i)).toHaveLength(2);
    // (-10%) appears in main row and HEIC row
    expect(screen.getAllByText('(-10%)')).toHaveLength(2);

    // Should show both optimization options with app-relative percentages
    expect(screen.getByText('Optimize:')).toBeInTheDocument();
    expect(screen.getByText(/-200\s*KB/i)).toBeInTheDocument();
    expect(screen.getByText('(-6.7%)')).toBeInTheDocument();

    expect(screen.getByText('Convert to HEIC:')).toBeInTheDocument();
  });

  it('shows only HEIC option when minify savings is zero', () => {
    const insightWithHeicOnly = ProcessedInsightFixture({
      files: [
        {
          path: 'already-optimized.png',
          savings: 472700,
          percentage: 10,
          data: {
            fileType: 'optimizable_image' as const,
            minifyPercentage: 0,
            conversionPercentage: 10,
            originalFile: {
              file_path: 'already-optimized.png',
              current_size: 802388,
              minify_savings: 0,
              minified_size: null,
              conversion_savings: 472700,
              heic_size: 329688,
            },
          },
        },
      ],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithHeicOnly}
        isExpanded
      />
    );

    expect(screen.getByText('already-optimized.png')).toBeInTheDocument();
    expect(screen.getByText('Convert to HEIC:')).toBeInTheDocument();
    expect(screen.queryByText('Optimize:')).not.toBeInTheDocument();
  });

  it('shows only optimize option when HEIC savings is zero', () => {
    const insightWithOptimizeOnly = ProcessedInsightFixture({
      files: [
        {
          path: 'no-heic.png',
          savings: 20020,
          percentage: 5,
          data: {
            fileType: 'optimizable_image' as const,
            minifyPercentage: 5,
            conversionPercentage: 0,
            originalFile: {
              file_path: 'no-heic.png',
              current_size: 505980,
              minify_savings: 20020,
              minified_size: 485960,
              conversion_savings: 0,
              heic_size: null,
            },
          },
        },
      ],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithOptimizeOnly}
        isExpanded
      />
    );

    expect(screen.getByText('no-heic.png')).toBeInTheDocument();
    expect(screen.getByText('Optimize:')).toBeInTheDocument();
    expect(screen.queryByText('Convert to HEIC:')).not.toBeInTheDocument();
  });

  it('renders with no files', () => {
    const insightWithNoFiles = ProcessedInsightFixture({
      files: [],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithNoFiles}
        isExpanded
      />
    );

    expect(screen.getByText('0 files')).toBeInTheDocument();
    expect(screen.queryByText(/^src\//)).not.toBeInTheDocument();
  });

  it('formats large file sizes correctly', () => {
    const insightWithLargeFiles = ProcessedInsightFixture({
      totalSavings: 5242880000, // 5 GB
      files: [
        {
          path: 'large-file.js',
          savings: 2147483648, // 2 GB
          percentage: 40,
          data: {
            fileType: 'regular' as const,
            originalFile: {
              file_path: 'large-file.js',
              total_savings: 2147483648,
            },
          },
        },
      ],
    });

    render(
      <AppSizeInsightsSidebarRow
        {...getDefaultProps()}
        insight={insightWithLargeFiles}
        isExpanded
      />
    );

    expect(screen.getByText('Potential savings 5.24 GB')).toBeInTheDocument();
    expect(screen.getByText(/-2\.15\s*GB/i)).toBeInTheDocument();
  });
});
