import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

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
        fileType: 'regular',
      },
      {
        path: 'src/components/Icon.js',
        savings: 256000,
        percentage: 4.0,
        fileType: 'regular',
      },
      {
        path: 'src/assets/logo.png',
        savings: 256000,
        percentage: 4.0,
        fileType: 'optimizable_image',
        originalFile: {
          path: 'src/assets/logo.png',
          type: 'optimizable_image',
          details: {
            recommendedFormat: 'webp',
            recommendedSize: 128000,
          },
        },
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
    expect(screen.getByText('Potential savings 1 MB')).toBeInTheDocument();
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
    expect(screen.getByText('-512 KB')).toBeInTheDocument();
    expect(screen.getByText('-256 KB')).toBeInTheDocument();
    expect(screen.getByText('(-7.5%)')).toBeInTheDocument();
    expect(screen.getByText('(-4%)')).toBeInTheDocument();
  });

  it('calls onToggleExpanded when clicking the toggle button', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsightsSidebarRow {...defaultProps} />);

    const toggleButton = screen.getByText('3 files');
    await user.click(toggleButton);

    expect(defaultProps.onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it('applies alternating background to file rows', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} isExpanded />);

    // The component uses internal logic for alternating, so we just check that files are rendered
    // In a more complete test, we could check the computed styles
    const files = screen.getAllByText(/^src\//);
    expect(files).toHaveLength(3);
  });

  it('handles optimizable image files', () => {
    render(<AppSizeInsightsSidebarRow {...defaultProps} isExpanded />);

    // Check that the optimizable image file is rendered
    // Note: The component currently renders it the same as regular files
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
    // Should not find any file paths
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
          fileType: 'regular',
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
    expect(screen.getByText('-2.15 GB')).toBeInTheDocument();
  });
});
