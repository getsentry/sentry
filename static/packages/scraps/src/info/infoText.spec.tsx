import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {InfoText} from '@sentry/scraps/info';
import {lightTheme} from '@sentry/scraps/theme';

import {getEmotionRules} from '../../test/getEmotionRules';

describe('InfoText', () => {
  function mockOverflow(width: number, containerWidth: number) {
    Object.defineProperty(HTMLElement.prototype, 'scrollWidth', {
      configurable: true,
      value: width,
    });
    Object.defineProperty(HTMLElement.prototype, 'clientWidth', {
      configurable: true,
      value: containerWidth,
    });
  }

  afterEach(() => {
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.scrollWidth;
    // @ts-expect-error cleanup previously mocked properties
    delete HTMLElement.prototype.clientWidth;
  });

  it('shows the tooltip only when text overflows without underlining the text', async () => {
    mockOverflow(100, 50);

    render(
      <InfoText title="Tooltip content" mode="overflowOnly">
        Text content
      </InfoText>,
      {wrapper: ThemeWrapper}
    );

    const text = screen.getByText('Text content');
    expect(text).toHaveAttribute('tabindex', '0');
    expect(text).toHaveAttribute('aria-describedby');
    expect(
      getEmotionRules(text).some(
        rule =>
          rule.includes('overflow: hidden') && rule.includes('text-overflow: ellipsis')
      )
    ).toBe(true);
    expect(text).not.toHaveStyle({textDecoration: 'underline'});

    await userEvent.hover(text);
    expect(screen.getByText('Tooltip content')).toBeInTheDocument();
  });

  it('does not show the tooltip when text does not overflow', async () => {
    mockOverflow(50, 100);

    render(
      <InfoText title="Tooltip content" mode="overflowOnly">
        Text content
      </InfoText>,
      {wrapper: ThemeWrapper}
    );

    const text = screen.getByText('Text content');
    expect(text).not.toHaveAttribute('tabindex');
    expect(text).not.toHaveAttribute('aria-describedby');

    await userEvent.hover(text);
    expect(screen.queryByText('Tooltip content')).not.toBeInTheDocument();
  });

  it('keeps regular InfoText keyboard interactive', () => {
    render(<InfoText title="Tooltip content">Text content</InfoText>, {
      wrapper: ThemeWrapper,
    });

    expect(screen.getByText('Text content')).toHaveAttribute('tabindex', '0');
  });

  it('supports ellipsis with the regular always-on tooltip', () => {
    render(
      <InfoText title="Tooltip content" ellipsis>
        Text content
      </InfoText>,
      {wrapper: ThemeWrapper}
    );

    const text = screen.getByText('Text content');
    expect(text).toHaveAttribute('tabindex', '0');
    expect(
      getEmotionRules(text).some(
        rule =>
          rule.includes('overflow: hidden') && rule.includes('text-overflow: ellipsis')
      )
    ).toBe(true);
  });
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
