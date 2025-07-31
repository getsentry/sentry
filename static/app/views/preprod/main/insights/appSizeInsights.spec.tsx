import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';

import {AppSizeInsights} from './appSizeInsights';

describe('AppSizeInsights', () => {
  const mockInsights: AppleInsightResults = {
    duplicate_files: {
      total_savings: 768000,
      groups: [
        {
          name: 'Duplicate files',
          total_savings: 768000,
          files: [
            {
              file_path: 'src/components/Button.js',
              total_savings: 512000,
            },
            {
              file_path: 'src/components/Icon.js',
              total_savings: 256000,
            },
          ],
        },
      ],
    },
    large_images: {
      total_savings: 512000,
      files: [
        {
          file_path: 'src/assets/logo.png',
          total_savings: 512000,
        },
      ],
    },
    large_videos: {
      total_savings: 256000,
      files: [
        {
          file_path: 'src/assets/video.mp4',
          total_savings: 256000,
        },
      ],
    },
  };

  const defaultProps = {
    insights: mockInsights,
    totalSize: 10240000,
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders nothing when totalSize is 0 or negative', () => {
    const {container} = render(<AppSizeInsights {...defaultProps} totalSize={0} />);
    expect(container).toBeEmptyDOMElement();

    const {container: container2} = render(
      <AppSizeInsights {...defaultProps} totalSize={-100} />
    );
    expect(container2).toBeEmptyDOMElement();
  });

  it('renders nothing when no insights are provided', () => {
    const {container} = render(<AppSizeInsights {...defaultProps} insights={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the main insights container with correct header', () => {
    render(<AppSizeInsights {...defaultProps} />);

    expect(screen.getByText('Top insights')).toBeInTheDocument();
    expect(screen.getByText('View all insights')).toBeInTheDocument();
  });

  it('displays only top 3 insights in the main view', () => {
    const manyInsights: AppleInsightResults = {
      duplicate_files: {
        total_savings: 768000,
        groups: [
          {
            name: 'Duplicate files',
            total_savings: 768000,
            files: [{file_path: 'file1.js', total_savings: 768000}],
          },
        ],
      },
      large_images: {
        total_savings: 512000,
        files: [{file_path: 'image1.png', total_savings: 512000}],
      },
      large_videos: {
        total_savings: 256000,
        files: [{file_path: 'video1.mp4', total_savings: 256000}],
      },
      unnecessary_files: {
        total_savings: 128000,
        files: [{file_path: 'temp.log', total_savings: 128000}],
      },
      small_files: {
        total_savings: 64000,
        files: [{file_path: 'tiny.txt', total_savings: 64000}],
      },
    };

    render(<AppSizeInsights {...defaultProps} insights={manyInsights} />);

    // Should show top 3 insights in main view
    expect(screen.getByText('Remove duplicate files')).toBeInTheDocument();
    expect(screen.getByText('Compress large images')).toBeInTheDocument();
    expect(screen.getByText('Compress large videos')).toBeInTheDocument();

    // Should NOT show lower priority insights in main view
    expect(screen.queryByText('Unnecessary files')).not.toBeInTheDocument();
    expect(screen.queryByText('Small files')).not.toBeInTheDocument();
  });

  it('formats file sizes and percentages correctly', () => {
    render(<AppSizeInsights {...defaultProps} />);

    // Check formatted file sizes (using formatBytesBase10)
    expect(screen.getByText('768 KB')).toBeInTheDocument(); // duplicate_files
    expect(screen.getByText('512 KB')).toBeInTheDocument(); // large_images
    expect(screen.getByText('256 KB')).toBeInTheDocument(); // large_videos

    // Check formatted percentages
    expect(screen.getByText('(7.5%)')).toBeInTheDocument(); // 768000/10240000
    expect(screen.getByText('(5%)')).toBeInTheDocument(); // 512000/10240000
    expect(screen.getByText('(2.5%)')).toBeInTheDocument(); // 256000/10240000
  });

  it('opens sidebar when "View all insights" button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsights {...defaultProps} />);

    // Initially sidebar should not be visible
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();

    // Click "View all insights" button
    const viewAllButton = screen.getByText('View all insights');
    await user.click(viewAllButton);

    // Sidebar should now be visible
    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
  });

  it('closes sidebar when sidebar onClose is called', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsights {...defaultProps} />);

    // Open sidebar
    const viewAllButton = screen.getByText('View all insights');
    await user.click(viewAllButton);
    expect(screen.getByText('Insights')).toBeInTheDocument();

    // Close sidebar
    const closeButton = screen.getByLabelText('Close sidebar');
    await user.click(closeButton);

    // Sidebar should be closed
    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });
});
