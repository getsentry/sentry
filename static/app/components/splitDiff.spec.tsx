import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import SplitDiff from 'sentry/components/splitDiff';

describe('SplitDiff', () => {
  it('shows differing content on each side for changed lines', () => {
    const base = `foo
bar`;
    const target = `foo
baz`;

    render(<SplitDiff base={base} target={target} />);

    const diff = screen.getByTestId('split-diff');
    const leftCells = within(diff).getAllByTestId('split-diff-left-cell');
    const rightCells = within(diff).getAllByTestId('split-diff-right-cell');

    expect(leftCells[0]).toHaveTextContent('foo');
    expect(rightCells[0]).toHaveTextContent('foo');
    expect(leftCells[1]).toHaveTextContent('bar');
    expect(rightCells[1]).toHaveTextContent('baz');
  });
});
