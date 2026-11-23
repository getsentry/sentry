import type * as React from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {Button} from '@sentry/scraps/button';
import {InputGroup} from '@sentry/scraps/input';
import {lightTheme} from '@sentry/scraps/theme';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

describe('InputGroup', () => {
  it('renders input', () => {
    render(
      <InputGroup>
        <InputGroup.Input value="Search" onChange={() => {}} />
      </InputGroup>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveDisplayValue('Search');
  });

  it('renders disabled input', () => {
    render(
      <InputGroup>
        <InputGroup.Input disabled />
      </InputGroup>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('renders leading elements', async () => {
    render(
      <InputGroup>
        <InputGroup.LeadingItems>
          <Button>Leading Button</Button>
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>,
      {wrapper: ThemeWrapper}
    );

    // Leading button is rendered
    expect(screen.getByTestId('input-leading-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toBeInTheDocument();

    // Focus moves first to leading button and then to input
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Leading Button'})).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
  });

  it('renders trailing elements', async () => {
    render(
      <InputGroup>
        <InputGroup.Input />
        <InputGroup.TrailingItems>
          <Button>Trailing Button</Button>
        </InputGroup.TrailingItems>
      </InputGroup>,
      {wrapper: ThemeWrapper}
    );

    // Trailing button is rendered
    expect(screen.getByTestId('input-trailing-items')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toBeInTheDocument();

    // Focus moves first to input and then to trailing button
    await userEvent.tab();
    expect(screen.getByRole('textbox')).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole('button', {name: 'Trailing Button'})).toHaveFocus();
  });

  it('does not remeasure items when their parent rerenders', () => {
    const offsetWidthSpy = jest
      .spyOn(HTMLElement.prototype, 'offsetWidth', 'get')
      .mockReturnValue(24);

    const renderGroup = (label: string) => (
      <InputGroup>
        <InputGroup.LeadingItems>
          <Button>{label}</Button>
        </InputGroup.LeadingItems>
        <InputGroup.Input />
      </InputGroup>
    );

    try {
      const {rerender} = render(renderGroup('initial'), {wrapper: ThemeWrapper});
      expect(offsetWidthSpy).toHaveBeenCalledTimes(1);

      rerender(renderGroup('updated'));
      expect(offsetWidthSpy).toHaveBeenCalledTimes(1);
    } finally {
      offsetWidthSpy.mockRestore();
    }
  });
});

it('composes a textarea with leading and trailing items', async () => {
  render(
    <InputGroup>
      <InputGroup.LeadingItems>Prefix</InputGroup.LeadingItems>
      <InputGroup.TextArea aria-label="Description" rows={4} />
      <InputGroup.TrailingItems>
        <Button>Clear</Button>
      </InputGroup.TrailingItems>
    </InputGroup>,
    {wrapper: ThemeWrapper}
  );
  const textarea = screen.getByRole('textbox', {name: 'Description'});
  expect(textarea.tagName).toBe('TEXTAREA');
  expect(textarea).toHaveAttribute('rows', '4');
  await userEvent.type(textarea, 'Text');
  expect(textarea).toHaveValue('Text');
  await userEvent.tab();
  expect(screen.getByRole('button', {name: 'Clear'})).toHaveFocus();
});
