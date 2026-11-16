import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {BreakdownCell} from './styles';

describe('trace table cells', () => {
  it('renders a table cell without forwarding highlightedSliceName', () => {
    render(
      <SimpleTable>
        <SimpleTable.Row>
          <BreakdownCell aria-label="Span breakdown" highlightedSliceName="database">
            Breakdown
          </BreakdownCell>
        </SimpleTable.Row>
      </SimpleTable>
    );

    const cell = screen.getByRole('cell', {name: 'Span breakdown'});
    expect(cell.tagName).toBe('TD');
    expect(cell).not.toHaveAttribute('highlightedSliceName');
  });
});
