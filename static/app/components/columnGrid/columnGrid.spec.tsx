import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ColumnGrid} from 'sentry/components/columnGrid';

describe('ColumnGrid', () => {
  it('renders items split into columns when given a column count', () => {
    render(
      <ColumnGrid
        columnCount={2}
        items={['a', 'b', 'c']}
        renderColumn={(columnItems, columnIndex) => (
          <div data-test-id={`column-${columnIndex}`}>{columnItems.join(',')}</div>
        )}
      />
    );

    expect(screen.getByTestId('column-0')).toHaveTextContent('a,b');
    expect(screen.getByTestId('column-1')).toHaveTextContent('c');
  });

  it('renders children after the columns when given children', () => {
    render(
      <ColumnGrid columnCount={3} items={[]} renderColumn={() => null}>
        <div>Nothing here</div>
      </ColumnGrid>
    );

    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
