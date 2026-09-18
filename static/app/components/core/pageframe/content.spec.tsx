import {render, screen} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Content} from './content';

describe('Content', () => {
  it.each(['center', 'full'] as const)('renders the %s variant as main', variant => {
    render(<Content variant={variant}>Content</Content>);

    expect(screen.getByRole('main')).toHaveTextContent('Content');
  });

  it('centers content at the previous size token and stops at 960px', () => {
    render(<Content variant="center">Content</Content>);

    const content = screen.getByRole('main');
    const contentRules = getEmotionRules(content);

    expect(contentRules.some(rule => rule.includes('container-type: inline-size'))).toBe(
      true
    );
    expect(contentRules.some(rule => rule.includes('margin: 0px auto'))).toBe(true);
    expect(
      contentRules.some(
        rule =>
          rule.includes('@container (min-width: 1024px)') &&
          rule.includes('max-width: 960px')
      )
    ).toBe(true);
    expect(contentRules.some(rule => rule.includes('max-width: 1024px'))).toBe(false);
  });

  it('does not constrain full-width content', () => {
    render(<Content variant="full">Content</Content>);

    const contentRules = getEmotionRules(screen.getByRole('main'));

    expect(contentRules.some(rule => rule.includes('max-width'))).toBe(false);
    expect(contentRules.some(rule => rule.includes('margin: 0px auto'))).toBe(false);
  });
});
