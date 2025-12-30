import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import type {DiffItem} from 'sentry/views/preprod/types/appSizeTypes';

import {GroupInsightItemDiffTable} from './groupInsightDiffTable';

const mockGroupDiffItems: DiffItem[] = [
  {
    path: 'icon.png',
    type: 'added',
    size_diff: 1500,
    head_size: 1500,
    base_size: null,
    item_type: null,
    diff_items: [
      {
        path: '/assets/icon1.png',
        type: 'added',
        size_diff: 500,
        head_size: 500,
        base_size: null,
        item_type: null,
        diff_items: null,
      },
      {
        path: '/assets/icon2.png',
        type: 'added',
        size_diff: 1000,
        head_size: 1000,
        base_size: null,
        item_type: null,
        diff_items: null,
      },
    ],
  },
  {
    path: 'LICENSE.txt',
    type: 'removed',
    size_diff: 0,
    head_size: 2000,
    base_size: 2000,
    item_type: null,
    diff_items: [
      {
        path: '/META-INF/LICENSE1.txt',
        type: 'removed',
        size_diff: 0,
        head_size: 1000,
        base_size: 1000,
        item_type: null,
        diff_items: null,
      },
      {
        path: '/META-INF/LICENSE2.txt',
        type: 'removed',
        size_diff: 0,
        head_size: 1000,
        base_size: 1000,
        item_type: null,
        diff_items: null,
      },
    ],
  },
];

describe('GroupInsightItemDiffTable', () => {
  it('renders empty state when no diff items', () => {
    render(<GroupInsightItemDiffTable groupDiffItems={[]} />);

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('displays group items with nested child items', () => {
    render(<GroupInsightItemDiffTable groupDiffItems={mockGroupDiffItems} />);

    // Check group headers
    expect(screen.getByText('icon.png')).toBeInTheDocument();
    expect(screen.getByText('LICENSE.txt')).toBeInTheDocument();

    // Check nested child items
    expect(screen.getByText('/assets/icon1.png')).toBeInTheDocument();
    expect(screen.getByText('/assets/icon2.png')).toBeInTheDocument();
    expect(screen.getByText('/META-INF/LICENSE1.txt')).toBeInTheDocument();
    expect(screen.getByText('/META-INF/LICENSE2.txt')).toBeInTheDocument();
  });

  it('displays correct status tags and sizes', () => {
    render(<GroupInsightItemDiffTable groupDiffItems={mockGroupDiffItems} />);

    // Check "Added" tags for icon.png group
    const addedTags = screen.getAllByText('Added');
    expect(addedTags).toHaveLength(3); // 1 group + 2 children

    // Check "Removed" tags for LICENSE.txt group
    const removedTags = screen.getAllByText('Removed');
    expect(removedTags).toHaveLength(3); // 1 group + 2 children

    // Check sizes
    expect(screen.getByText('+1.5 KB')).toBeInTheDocument(); // Group total
    expect(screen.getByText('+500 B')).toBeInTheDocument(); // Child 1
    expect(screen.getByText('+1 KB')).toBeInTheDocument(); // Child 2
  });

  it('supports sorting by different fields', async () => {
    render(<GroupInsightItemDiffTable groupDiffItems={mockGroupDiffItems} />);

    // Click on Status header to sort by type
    const statusHeader = screen.getByRole('columnheader', {name: 'Status'});
    await userEvent.click(statusHeader);

    // After sorting by status, "added" items should come first (order: added < unchanged)
    const rows = screen.getAllByRole('row');
    // First data row should contain the "added" group
    expect(within(rows[1]!).getByText('icon.png')).toBeInTheDocument();
  });

  it('handles pagination correctly with nested items', async () => {
    // Create enough items to trigger pagination (need more than ITEMS_PER_PAGE)
    const manyItems: DiffItem[] = [];
    for (let i = 0; i < 15; i++) {
      manyItems.push({
        path: `group${i}.txt`,
        type: 'added',
        size_diff: 100 * i,
        head_size: 100 * i,
        base_size: null,
        item_type: null,
        diff_items: [
          {
            path: `/path/file${i}a.txt`,
            type: 'added',
            size_diff: 50 * i,
            head_size: 50 * i,
            base_size: null,
            item_type: null,
            diff_items: null,
          },
          {
            path: `/path/file${i}b.txt`,
            type: 'added',
            size_diff: 50 * i,
            head_size: 50 * i,
            base_size: null,
            item_type: null,
            diff_items: null,
          },
        ],
      });
    }

    render(<GroupInsightItemDiffTable groupDiffItems={manyItems} />);

    // Should show pagination controls
    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();

    // Navigate to next page
    const nextButton = screen.getByLabelText('Next');
    await userEvent.click(nextButton);

    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();

    // Navigate back
    const prevButton = screen.getByLabelText('Previous');
    await userEvent.click(prevButton);

    expect(screen.getByText('Page 1 of 2')).toBeInTheDocument();
  });

  it('handles group without nested items', () => {
    const groupWithoutChildren: DiffItem[] = [
      {
        path: 'simple.txt',
        type: 'removed',
        size_diff: -500,
        head_size: null,
        base_size: 500,
        item_type: null,
        diff_items: null,
      },
    ];

    render(<GroupInsightItemDiffTable groupDiffItems={groupWithoutChildren} />);

    expect(screen.getByText('simple.txt')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getByText('-500 B')).toBeInTheDocument();
  });

  it('displays tooltips with copy functionality for paths', async () => {
    render(<GroupInsightItemDiffTable groupDiffItems={mockGroupDiffItems} />);

    // Hover over a path to show tooltip
    const pathElement = screen.getByText('icon.png');
    await userEvent.hover(pathElement);

    // Should show copy button in tooltip
    expect(await screen.findByLabelText('Copy path to clipboard')).toBeInTheDocument();
  });
});
