import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {SingleColumnPage} from './singleColumnPage';

describe('SingleColumnPage', () => {
  it.each(['narrow', 'wide', 'full'] as const)('renders the %s width as main', width => {
    render(<SingleColumnPage width={width}>Content</SingleColumnPage>);

    expect(screen.getByRole('main')).toHaveTextContent('Content');
  });

  it('centers narrow content and stops at 960px', () => {
    render(<SingleColumnPage width="narrow">Content</SingleColumnPage>);

    const rules = getEmotionRules(screen.getByRole('main'));

    expect(rules.some(rule => rule.includes('container-type: inline-size'))).toBe(true);
    expect(rules.some(rule => rule.includes('margin: 0px auto'))).toBe(true);
    expect(
      rules.some(
        rule =>
          rule.includes('@container (min-width: 1024px)') &&
          rule.includes('max-width: 960px')
      )
    ).toBe(true);
  });

  it('centers wide content and stops at 1440px', () => {
    render(<SingleColumnPage width="wide">Content</SingleColumnPage>);

    const rules = getEmotionRules(screen.getByRole('main'));

    expect(rules.some(rule => rule.includes('margin: 0px auto'))).toBe(true);
    expect(rules.some(rule => rule.includes('max-width: 1440px'))).toBe(true);
  });

  it('does not constrain full-width content', () => {
    render(<SingleColumnPage width="full">Content</SingleColumnPage>);

    const rules = getEmotionRules(screen.getByRole('main'));

    expect(rules.some(rule => rule.includes('max-width'))).toBe(false);
    expect(rules.some(rule => rule.includes('margin: 0px auto'))).toBe(false);
  });
});
