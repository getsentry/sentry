import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {BreakdownPanelItem} from './styles';

describe('trace table panel items', () => {
  it('preserves element selection and styles without forwarding styling props', () => {
    render(
      <BreakdownPanelItem
        as="section"
        aria-label="Span breakdown"
        highlightedSliceName="database"
        overflow
      >
        Breakdown
      </BreakdownPanelItem>
    );

    const panel = screen.getByRole('region', {name: 'Span breakdown'});
    expect(panel.tagName).toBe('SECTION');
    const styles = getEmotionRules(panel).join(' ');
    expect(styles).toMatch(/overflow:\s*hidden/);
    expect(styles).toMatch(/text-overflow:\s*ellipsis/);
    expect(panel).not.toHaveAttribute('overflow');
    expect(panel).not.toHaveAttribute('highlightedSliceName');
    expect(panel).not.toHaveAttribute('as');
  });
});
