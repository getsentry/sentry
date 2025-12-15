import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {TreemapType, type DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

import {FileInsightItemDiffTable} from './fileInsightDiffTable';

const mockFileDiffItems: DiffItem[] = [
  {
    path: '/assets/large-image.png',
    type: 'added',
    size_diff: 2500000,
    head_size: 2500000,
    base_size: null,
    item_type: TreemapType.ASSETS,
    diff_items: null,
  },
  {
    path: '/components/utils.js',
    type: 'removed',
    size_diff: -150000,
    head_size: null,
    base_size: 150000,
    item_type: TreemapType.EXECUTABLES,
    diff_items: null,
  },
  {
    path: '/lib/library.so',
    type: 'decreased',
    size_diff: 0,
    head_size: 0,
    base_size: 1000000,
    item_type: TreemapType.NATIVE_LIBRARIES,
    diff_items: null,
  },
];

describe('FileInsightItemDiffTable', () => {
  it('renders empty state when no diff items', () => {
    render(<FileInsightItemDiffTable fileDiffItems={[]} />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('displays file items with correct information', () => {
    render(<FileInsightItemDiffTable fileDiffItems={mockFileDiffItems} />);

    // Check file paths
    expect(screen.getByText('/assets/large-image.png')).toBeInTheDocument();
    expect(screen.getByText('/components/utils.js')).toBeInTheDocument();
    expect(screen.getByText('/lib/library.so')).toBeInTheDocument();

    // Check status tags
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('Decreased')).toBeInTheDocument();

    // Check sizes
    expect(screen.getByText('+2.5 MB')).toBeInTheDocument();
    expect(screen.getByText('-150 KB')).toBeInTheDocument();
    expect(screen.getByText('-1 MB')).toBeInTheDocument();
  });

  it('supports sorting by different fields', async () => {
    render(<FileInsightItemDiffTable fileDiffItems={mockFileDiffItems} />);

    // Click on Status header to sort by type
    const statusHeader = screen.getByRole('columnheader', {name: 'Status'});
    await userEvent.click(statusHeader);

    // After sorting by status ascending, "added" should come first
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]!).getByText('/assets/large-image.png')).toBeInTheDocument();

    // Click again to sort descending
    await userEvent.click(statusHeader);

    // Now "removed" (highest order value) should come first
    expect(within(rows[1]!).getByText('/components/utils.js')).toBeInTheDocument();
  });

  it('supports sorting by path', async () => {
    render(<FileInsightItemDiffTable fileDiffItems={mockFileDiffItems} />);

    // Click on Affected Files header to sort by path
    const pathHeader = screen.getByRole('columnheader', {name: 'Affected Files'});
    await userEvent.click(pathHeader);

    // Should sort alphabetically by path
    const rows = screen.getAllByRole('row');
    expect(within(rows[1]!).getByText('/assets/large-image.png')).toBeInTheDocument();
  });

  it('handles pagination correctly', async () => {
    // Create enough items to trigger pagination (need more than ITEMS_PER_PAGE)
    const manyItems: DiffItem[] = [];
    for (let i = 0; i < 50; i++) {
      manyItems.push({
        path: `/file${i}.txt`,
        type: 'added',
        size_diff: 1000 + i,
        head_size: 1000 + i,
        base_size: null,
        item_type: TreemapType.FILES,
        diff_items: null,
      });
    }

    render(<FileInsightItemDiffTable fileDiffItems={manyItems} />);

    // Should show pagination controls
    expect(screen.getByText(/Page 1 of \d+/)).toBeInTheDocument();

    // Navigate to next page
    const nextButton = screen.getByLabelText('Next');
    await userEvent.click(nextButton);

    expect(screen.getByText(/Page 2 of \d+/)).toBeInTheDocument();

    // Navigate back
    const prevButton = screen.getByLabelText('Previous');
    await userEvent.click(prevButton);

    expect(screen.getByText(/Page 1 of \d+/)).toBeInTheDocument();
  });

  it('handles items with empty paths gracefully', () => {
    const itemsWithNullPaths: DiffItem[] = [
      {
        path: '',
        type: 'added',
        size_diff: 1000,
        head_size: 1000,
        base_size: null,
        item_type: null,
        diff_items: null,
      },
    ];

    render(<FileInsightItemDiffTable fileDiffItems={itemsWithNullPaths} />);

    // Should render without crashing and show empty string for path
    expect(screen.getByText('Added')).toBeInTheDocument();
    expect(screen.getByText('+1 KB')).toBeInTheDocument();
  });

  it('displays tooltips with copy functionality for paths', async () => {
    render(<FileInsightItemDiffTable fileDiffItems={mockFileDiffItems} />);

    // Hover over a path to show tooltip
    const pathElement = screen.getByText('/assets/large-image.png');
    await userEvent.hover(pathElement);

    // Should show copy button in tooltip
    expect(await screen.findByLabelText('Copy path to clipboard')).toBeInTheDocument();
  });

  it('handles zero size diff correctly', () => {
    const zeroSizeDiffItems: DiffItem[] = [
      {
        path: '/zero-change.txt',
        type: 'decreased',
        size_diff: 0,
        head_size: 0,
        base_size: 500,
        item_type: TreemapType.FILES,
        diff_items: null,
      },
    ];

    render(<FileInsightItemDiffTable fileDiffItems={zeroSizeDiffItems} />);

    expect(screen.getByText('/zero-change.txt')).toBeInTheDocument();
    expect(screen.getByText('Decreased')).toBeInTheDocument();
    expect(screen.getByText('-500 B')).toBeInTheDocument(); // Should show absolute value with minus
  });

  it('disables pagination buttons appropriately', async () => {
    // Create just enough items for 2 pages
    const twoPageItems: DiffItem[] = [];
    for (let i = 0; i < 45; i++) {
      twoPageItems.push({
        path: `/file${i}.txt`,
        type: 'added',
        size_diff: 1000,
        head_size: 1000,
        base_size: null,
        item_type: TreemapType.FILES,
        diff_items: null,
      });
    }

    render(<FileInsightItemDiffTable fileDiffItems={twoPageItems} />);

    // On first page, previous should be disabled
    const prevButton = screen.getByLabelText('Previous');
    const nextButton = screen.getByLabelText('Next');

    expect(prevButton).toBeDisabled();
    expect(nextButton).toBeEnabled();

    // Go to last page
    await userEvent.click(nextButton);

    // On last page, next should be disabled
    expect(prevButton).toBeEnabled();
    expect(nextButton).toBeDisabled();
  });
});
