import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import SplitDiff from 'sentry/components/splitDiff';

describe('SplitDiff', () => {
  it('shows differing content on each side for changed lines', () => {
    const base = `foo
bar`;
    const target = `foo
baz`;

    render(<SplitDiff base={base} target={target} />);

    const rows = within(screen.getByTestId('split-diff')).getAllByRole('row');
    const firstRowCells = within(rows[0]!).getAllByRole('cell');
    const secondRowCells = within(rows[1]!).getAllByRole('cell');

    expect(firstRowCells[0]).toHaveTextContent('foo');
    expect(firstRowCells[2]).toHaveTextContent('foo');
    expect(secondRowCells[0]).toHaveTextContent('bar');
    expect(secondRowCells[2]).toHaveTextContent('baz');
  });
});
