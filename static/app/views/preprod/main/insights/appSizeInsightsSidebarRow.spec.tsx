import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {OptimizableImageFile} from 'sentry/views/preprod/types/appSizeTypes';
import type {ProcessedInsight} from 'sentry/views/preprod/utils/insightProcessing';

import {AppSizeInsightsSidebarRow} from './appSizeInsightsSidebarRow';

describe('AppSizeInsightsSidebarRow', () => {
  const mockInsight: ProcessedInsight = {
    name: 'Duplicate files',
    description: 'You have files that are duplicated across your app',
    totalSavings: 1024000,
    percentage: 15.5,
    files: [
      {
        path: 'src/components/Button.js',
        savings: 512000,
        percentage: 7.5,
        fileType: 'regular' as const,
      },
      {
        path: 'src/components/Icon.js',
        savings: 256000,
        percentage: 4.0,
        fileType: 'regular' as const,
      },
      {
        path: 'src/assets/logo.png',
        savings: 256000,
        percentage: 4.0,
        fileType: 'optimizable_image' as const,
        originalFile: {
          best_optimization_type: 'convert_to_heic',
          conversion_savings: 128000,
          current_size: 256000,
          file_path: 'src/assets/logo.png',
          heic_size: 128000,
          minified_size: null,
          minify_savings: 0,
          potential_savings: 128000,
        } as OptimizableImageFile,
      },
    ],
  };

  const defaultProps = {
    insight: mockInsight,
    isExpanded: false,
    onToggleExpanded: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders insight name and savings information', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} />);

    expect(screen.getByText('Duplicate files')).toBeInTheDocument();
    expect(
      screen.getByText('You have files that are duplicated across your app')
    ).toBeInTheDocument();
    expect(screen.getByText('Potential savings 1.02 MB')).toBeInTheDocument();
    expect(screen.getByText('15.5%')).toBeInTheDocument();
  });

  it('shows file count button', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} />);

    expect(screen.getByText('3 files')).toBeInTheDocument();
  });

  it('does not show files when collapsed', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} />);

    expect(screen.queryByText('src/components/Button.js')).not.toBeInTheDocument();
    expect(screen.queryByText('src/components/Icon.js')).not.toBeInTheDocument();
  });

  it('shows files when expanded', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} isExpanded />);

    expect(screen.getByText('src/components/Button.js')).toBeInTheDocument();
    expect(screen.getByText('src/components/Icon.js')).toBeInTheDocument();
    expect(screen.getByText('src/assets/logo.png')).toBeInTheDocument();

    // Check file savings are displayed with negative values
    expect(screen.getByText(/-\s*512\s*KB/i)).toBeInTheDocument();
    // Two files have 256 KB savings, so we expect 2 matches
    expect(screen.getAllByText(/-\s*256\s*KB/i)).toHaveLength(2);
    expect(screen.getByText('(-7.5%)')).toBeInTheDocument();
    // Two files have (-4%) savings, so we expect 2 matches
    expect(screen.getAllByText('(-4%)')).toHaveLength(2);
  });

  it('calls onToggleExpanded when clicking the toggle button', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsightsSidebarRow {...defaultProps} />);

    const toggleButton = screen.getByRole('button', {name: /3 files/i});
    await user.click(toggleButton);

    expect(defaultProps.onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('handles optimizable image files', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} isExpanded />);
    expect(screen.getByText('src/assets/logo.png')).toBeInTheDocument();
  });

  it('renders with no files', () => {
    const insightWithNoFiles = {
      ...mockInsight,
      files: [],
    };

    render(
      <AppSizeInsightsSidebarRow
        {...defaultProps}
        insight={insightWithNoFiles}
        isExpanded
      />
    );

    expect(screen.getByText('0 files')).toBeInTheDocument();
    expect(screen.queryByText(/^src\//)).not.toBeInTheDocument();
  });

  it('formats large file sizes correctly', () => {
    const insightWithLargeFiles = {
      ...mockInsight,
      totalSavings: 5242880000, // 5 GB
      files: [
        {
          path: 'large-file.js',
          savings: 2147483648, // 2 GB
          percentage: 40,
          fileType: 'regular' as const,
        },
      ],
    };

    render(
      <AppSizeInsightsSidebarRow
        {...defaultProps}
        insight={insightWithLargeFiles}
        isExpanded
      />
    );

    expect(screen.getByText('Potential savings 5.24 GB')).toBeInTheDocument();
    expect(screen.getByText(/-2\.15\s*GB/i)).toBeInTheDocument();
  });
});
