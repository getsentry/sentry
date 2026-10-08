import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

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

  it('renders a link to the sort target when given to', () => {
    render(<SortableHeaderCell to="/sorted/">Duration</SortableHeaderCell>);

    expect(screen.getByRole('link', {name: 'Duration'})).toHaveAttribute(
      'href',
      '/sorted/'
    );
  });

  it('calls onSort when the link is clicked', async () => {
    const onSort = jest.fn();
    render(
      <SortableHeaderCell onSort={onSort} to="/sorted/">
        Duration
      </SortableHeaderCell>
    );

    await userEvent.click(screen.getByRole('link', {name: 'Duration'}));

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('fills the cell with an aligned label when the column is not sorted', () => {
    render(<SortableHeaderCell align="right">Duration</SortableHeaderCell>);

    const rules = getEmotionRules(screen.getByText('Duration')).join('');

    expect(rules).toContain('flex: 1');
    expect(rules).toContain('text-align: right');
  });

  it('sizes the label to its content when the column is sorted', () => {
    render(
      <SortableHeaderCell align="right" direction="desc">
        Duration
      </SortableHeaderCell>
    );

    expect(getEmotionRules(screen.getByText('Duration')).join('')).not.toContain(
      'flex: 1'
    );
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
