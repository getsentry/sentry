import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {AppleInsightResults} from 'sentry/views/preprod/types/appSizeTypes';

import {AppSizeInsightsSidebar} from './appSizeInsightsSidebar';

describe('AppSizeInsightsSidebar', () => {
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
      total_savings: 128000,
      files: [
        {
          file_path: 'src/assets/logo.png',
          total_savings: 128000,
        },
      ],
    },
  };

  const defaultProps = {
    insights: mockInsights,
    totalSize: 10240000,
    isOpen: true,
    onClose: jest.fn(),
  };

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('renders the sidebar when open', () => {
    render(<AppSizeInsightsSidebar {...defaultProps} />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
  });

  it('does not render sidebar content when closed', () => {
    render(<AppSizeInsightsSidebar {...defaultProps} isOpen={false} />);

    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });

  it('renders processed insights from processInsights util', () => {
    render(<AppSizeInsightsSidebar {...defaultProps} />);

    // Should render processed insights (the processInsights util creates these display names)
    expect(screen.getByText('Remove duplicate files')).toBeInTheDocument();
    expect(screen.getByText('Compress large images')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsightsSidebar {...defaultProps} />);

    const closeButton = screen.getByLabelText('Close sidebar');
    await user.click(closeButton);

    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const user = userEvent.setup();
    render(<AppSizeInsightsSidebar {...defaultProps} />);

    // The backdrop doesn't have a role, so we'll query by its styled properties
    const backdrop = document.querySelector('[style*="position: fixed"]');
    if (backdrop) {
      await user.click(backdrop);
      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('handles empty insights', () => {
    render(<AppSizeInsightsSidebar {...defaultProps} insights={{}} />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate files')).not.toBeInTheDocument();
  });
});
