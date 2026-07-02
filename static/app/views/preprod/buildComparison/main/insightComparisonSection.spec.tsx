import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import * as analytics from 'sentry/utils/analytics';
import {type InsightDiffItem, TreemapType} from 'sentry/views/preprod/types/appSizeTypes';

import {InsightComparisonSection} from './insightComparisonSection';

const mockInsightDiffItems: InsightDiffItem[] = [
  {
    insight_type: 'large_images',
    status: 'new',
    total_savings_change: 2_500_000,
    file_diffs: [
      {
        path: '/assets/hero-banner.png',
        type: 'added',
        size_diff: 2_500_000,
        head_size: 2_500_000,
        base_size: null,
        item_type: TreemapType.ASSETS,
        diff_items: null,
      },
    ],
    group_diffs: [],
  },
  {
    insight_type: 'large_videos',
    status: 'unresolved',
    total_savings_change: 500_000,
    file_diffs: [
      {
        path: '/assets/intro.mp4',
        type: 'increased',
        size_diff: 500_000,
        head_size: 1_000_000,
        base_size: 500_000,
        item_type: TreemapType.ASSETS,
        diff_items: null,
      },
    ],
    group_diffs: [],
  },
];

describe('InsightComparisonSection', () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
  });

  it('renders the section heading and copy button', () => {
    render(
      <InsightComparisonSection
        insightDiffItems={mockInsightDiffItems}
        totalInstallSizeBytes={50_000_000}
      />
    );

    expect(screen.getByRole('heading', {name: 'Insight Diff'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Copy as JSON'})).toBeInTheDocument();
  });

  it('copies the entire insight diff as JSON to the clipboard', async () => {
    render(
      <InsightComparisonSection
        insightDiffItems={mockInsightDiffItems}
        totalInstallSizeBytes={50_000_000}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy as JSON'}));

    // Copies all insights, not just the currently displayed/selected tab.
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      JSON.stringify(mockInsightDiffItems, null, 2)
    );
  });

  it('tracks an analytics event with the insight count when copying', async () => {
    const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

    render(
      <InsightComparisonSection
        insightDiffItems={mockInsightDiffItems}
        totalInstallSizeBytes={50_000_000}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Copy as JSON'}));

    expect(analyticsSpy).toHaveBeenCalledWith(
      'preprod.builds.compare.copy_insight_diff',
      expect.objectContaining({insight_count: mockInsightDiffItems.length})
    );
  });
});
