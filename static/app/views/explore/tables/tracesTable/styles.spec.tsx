import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {SimpleTable} from 'sentry/components/tables/simpleTable';

import {BreakdownCell} from './styles';

describe('trace table cells', () => {
  it('sets slice highlight variables when highlightedSliceName is provided', () => {
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
    const styles = getEmotionRules(cell).join(' ');
    expect(styles).toMatch(/--highlightedSlice-database-opacity:\s*1\.0/);
    expect(cell).not.toHaveAttribute('highlightedSliceName');
  });
});
