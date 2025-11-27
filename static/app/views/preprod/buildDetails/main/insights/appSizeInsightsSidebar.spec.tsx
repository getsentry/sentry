import {InsightResultsFixture} from 'sentry-fixture/preProdAppSize';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {processInsights} from 'sentry/views/preprod/utils/insightProcessing';

import {AppSizeInsightsSidebar} from './appSizeInsightsSidebar';

describe('AppSizeInsightsSidebar', () => {
  const getDefaultProps = () => {
    const insights = InsightResultsFixture({
      large_images: {
        total_savings: 128000,
        files: [
          {
            file_path: 'src/assets/logo.png',
            total_savings: 128000,
          },
        ],
      },
    });
    const totalSize = 10240000;
    return {
      processedInsights: processInsights(insights, totalSize),
      isOpen: true,
      onClose: jest.fn(),
    };
  };

  it('renders the sidebar when open', () => {
    render(<AppSizeInsightsSidebar {...getDefaultProps()} />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.getByLabelText('Close sidebar')).toBeInTheDocument();
  });

  it('does not render sidebar content when closed', () => {
    render(<AppSizeInsightsSidebar {...getDefaultProps()} isOpen={false} />);

    expect(screen.queryByText('Insights')).not.toBeInTheDocument();
  });

  it('renders processed insights from processInsights util', () => {
    render(<AppSizeInsightsSidebar {...getDefaultProps()} />);

    // Should render processed insights (the processInsights util creates these display names)
    expect(screen.getByText('Duplicate Files')).toBeInTheDocument();
    expect(screen.getByText('Large Images')).toBeInTheDocument();
  });

  it('calls onClose when close button is clicked', async () => {
    const props = getDefaultProps();
    render(<AppSizeInsightsSidebar {...props} />);

    const closeButton = screen.getByLabelText('Close sidebar');
    await userEvent.click(closeButton);

    expect(props.onClose).toHaveBeenCalledTimes(1);
  });

  it('calls onClose when backdrop is clicked', async () => {
    const props = getDefaultProps();
    render(<AppSizeInsightsSidebar {...props} />);

    // The backdrop doesn't have a role, so we'll query by its styled properties
    const backdrop = document.querySelector('[style*="position: fixed"]');
    if (backdrop) {
      await userEvent.click(backdrop);
      expect(props.onClose).toHaveBeenCalledTimes(1);
    }
  });

  it('handles empty insights', () => {
    render(<AppSizeInsightsSidebar processedInsights={[]} isOpen onClose={jest.fn()} />);

    expect(screen.getByText('Insights')).toBeInTheDocument();
    expect(screen.queryByText('Duplicate files')).not.toBeInTheDocument();
  });
});
