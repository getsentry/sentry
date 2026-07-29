import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  getAriaSort,
  SortableHeaderCell,
} from 'sentry/components/tables/sortableHeaderCell';

describe('SortableHeaderCell', () => {
  it('calls onSort when clicked', async () => {
    const onSort = jest.fn();
    render(<SortableHeaderCell onSort={onSort}>Duration</SortableHeaderCell>);

    await userEvent.click(screen.getByRole('button', {name: 'Duration'}));

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive cell when not given onSort', () => {
    render(<SortableHeaderCell>Duration</SortableHeaderCell>);

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no indicator when the column is not sorted', () => {
    render(<SortableHeaderCell onSort={jest.fn()}>Duration</SortableHeaderCell>);

    expect(screen.queryByRole('img', {hidden: true})).not.toBeInTheDocument();
  });

  it('points the indicator down when sorted descending', () => {
    render(
      <SortableHeaderCell direction="desc" onSort={jest.fn()}>
        Duration
      </SortableHeaderCell>
    );

    expect(screen.getByRole('img', {hidden: true})).toHaveStyle({
      transform: 'scale(1, -1)',
    });
  });
});

describe('getAriaSort', () => {
  it('returns ascending when sorted ascending', () => {
    expect(getAriaSort('asc')).toBe('ascending');
  });

  it('returns descending when sorted descending', () => {
    expect(getAriaSort('desc')).toBe('descending');
  });

  it('returns undefined when unsorted', () => {
    expect(getAriaSort(undefined)).toBeUndefined();
  });
});
