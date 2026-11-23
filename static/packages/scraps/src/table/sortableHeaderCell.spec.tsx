import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {getAriaSort, SortableHeaderCell} from '@sentry/scraps/table';
import {lightTheme} from '@sentry/scraps/theme';

describe('SortableHeaderCell', () => {
  it('calls onSort when clicked', async () => {
    const onSort = jest.fn();
    renderWithTheme(<SortableHeaderCell onSort={onSort}>Duration</SortableHeaderCell>);

    await userEvent.click(screen.getByRole('button', {name: 'Duration'}));

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renders a non-interactive cell when not given onSort', () => {
    renderWithTheme(<SortableHeaderCell>Duration</SortableHeaderCell>);

    expect(screen.getByText('Duration')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders a link to the sort target when given to', () => {
    renderWithTheme(<SortableHeaderCell to="/sorted/">Duration</SortableHeaderCell>);

    expect(screen.getByRole('link', {name: 'Duration'})).toHaveAttribute(
      'href',
      '/sorted/'
    );
  });

  it('calls onSort when the link is clicked', async () => {
    const onSort = jest.fn();
    renderWithTheme(
      <SortableHeaderCell onSort={onSort} to="/sorted/">
        Duration
      </SortableHeaderCell>
    );

    await userEvent.click(screen.getByRole('link', {name: 'Duration'}));

    expect(onSort).toHaveBeenCalledTimes(1);
  });

  it('renders no indicator when the column is not sorted', () => {
    renderWithTheme(<SortableHeaderCell onSort={jest.fn()}>Duration</SortableHeaderCell>);

    expect(screen.queryByRole('img', {hidden: true})).not.toBeInTheDocument();
  });

  it('points the indicator down when sorted descending', () => {
    renderWithTheme(
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

function renderWithTheme(ui: React.ReactElement) {
  return render(ui, {
    wrapper: ({children}) => <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>,
  });
}
