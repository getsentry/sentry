import type * as React from 'react';
import {Fragment, useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen, waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import {darkTheme, lightTheme} from '@sentry/scraps/theme';
import {ToggleCard} from '@sentry/scraps/toggleCard';
import {Tooltip} from '@sentry/scraps/tooltip';

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}

function ToggleCards() {
  const [value, setValue] = useState('first');
  return (
    <fieldset>
      <legend>Choose an option</legend>
      {['first', 'second'].map(option => (
        <ToggleCard
          variant="radio"
          key={option}
          name="options"
          value={option}
          checked={value === option}
          onChange={event => setValue(event.currentTarget.value)}
        >
          {option}
        </ToggleCard>
      ))}
    </fieldset>
  );
}

function ExpandableToggleCard() {
  const [checked, setChecked] = useState(false);
  return (
    <ToggleCard
      variant="checkbox"
      checked={checked}
      onChange={event => setChecked(event.currentTarget.checked)}
      details={<input aria-label="Threshold" defaultValue="10" />}
    >
      <ToggleCard.Indicator />
      Custom threshold
    </ToggleCard>
  );
}

describe('ToggleCard', () => {
  it.each([
    {name: 'light', theme: lightTheme},
    {name: 'dark', theme: darkTheme},
  ])('only dims unselected disabled cards in $name mode', ({theme}) => {
    render(
      <ThemeProvider theme={theme}>
        <ToggleCard
          variant="checkbox"
          checked
          disabled
          onChange={jest.fn()}
          data-test-id="selected"
        >
          Included product
        </ToggleCard>
        <ToggleCard
          variant="checkbox"
          checked={false}
          disabled
          onChange={jest.fn()}
          data-test-id="unselected"
        >
          Unavailable product
        </ToggleCard>
      </ThemeProvider>
    );

    expect(screen.getByTestId('selected')).not.toHaveStyle({
      opacity: theme.tokens.interactive.disabled,
    });
    expect(screen.getByTestId('unselected')).toHaveStyle({
      opacity: theme.tokens.interactive.disabled,
    });
  });

  it('keeps expanded fields independent of the selection trigger', async () => {
    const scrollTo = jest.spyOn(window, 'scrollTo').mockImplementation(() => {});
    render(<ExpandableToggleCard />, {wrapper: ThemeWrapper});
    expect(screen.queryByRole('textbox', {name: 'Threshold'})).not.toBeInTheDocument();
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('aria-controls');

    await userEvent.click(screen.getByText('Custom threshold'));
    const checkbox = screen.getByRole('checkbox', {name: 'Custom threshold'});
    const threshold = screen.getByRole('textbox', {name: 'Threshold'});
    expect(checkbox).toBeChecked();
    expect(checkbox).toHaveAttribute('aria-controls', expect.any(String));
    await userEvent.clear(threshold);
    await userEvent.type(threshold, '20');
    expect(threshold).toHaveValue('20');
    expect(checkbox).toBeChecked();

    await userEvent.click(screen.getByText('Custom threshold'));
    expect(checkbox).not.toBeChecked();
    await waitFor(() =>
      expect(screen.queryByRole('textbox', {name: 'Threshold'})).not.toBeInTheDocument()
    );
    scrollTo.mockRestore();
  });

  it('applies focus and validation attributes to the native input', async () => {
    render(
      <Fragment>
        <ToggleCard
          id="product"
          variant="checkbox"
          checked={false}
          onChange={jest.fn()}
          tabIndex={-1}
          aria-invalid
          aria-errormessage="error"
        >
          Product
        </ToggleCard>
        <ToggleCard variant="button">Continue</ToggleCard>
      </Fragment>,
      {wrapper: ThemeWrapper}
    );

    expect(screen.getByRole('checkbox')).toHaveAttribute('id', 'product');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-errormessage', 'error');
    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
  });

  it('selects by clicking anywhere on the card and by arrow keys', async () => {
    render(<ToggleCards />, {wrapper: ThemeWrapper});

    await userEvent.click(screen.getByText('second'));
    expect(screen.getByRole('radio', {name: 'second'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'first'})).not.toBeChecked();

    screen.getByRole('radio', {name: 'second'}).focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(screen.getByRole('radio', {name: 'first'})).toBeChecked();
    expect(screen.getByRole('radio', {name: 'first'})).toHaveFocus();
  });

  it('toggles a checkbox with the keyboard', async () => {
    const onChange = jest.fn();
    render(
      <ToggleCard variant="checkbox" checked={false} onChange={onChange}>
        Product
      </ToggleCard>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.tab();
    expect(screen.getByRole('checkbox', {name: 'Product'})).toHaveFocus();
    await userEvent.keyboard(' ');
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('keeps a disabled card focusable for its reason without allowing activation', async () => {
    const onChange = jest.fn();
    render(
      <Tooltip title="Unavailable on this plan" skipWrapper delay={0}>
        <ToggleCard variant="checkbox" checked={false} onChange={onChange} disabled>
          Product
        </ToggleCard>
      </Tooltip>,
      {wrapper: ThemeWrapper}
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Product'});
    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    expect(await screen.findByText('Unavailable on this plan')).toBeVisible();
    expect(checkbox).toHaveAccessibleDescription('Unavailable on this plan');
    await userEvent.keyboard(' ');
    await userEvent.click(screen.getByText('Product'));
    expect(onChange).not.toHaveBeenCalled();
    expect(checkbox).not.toBeChecked();
  });

  it('renders an action that does not submit its containing form', async () => {
    const onClick = jest.fn();
    const onSubmit = jest.fn();
    render(
      <form onSubmit={onSubmit}>
        <ToggleCard variant="button" onClick={onClick}>
          Set up manually
        </ToggleCard>
      </form>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Set up manually'}));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('excludes disabled selections from form submission and validation', () => {
    render(
      <form aria-label="Options">
        <ToggleCard
          variant="checkbox"
          name="product"
          value="errors"
          checked
          required
          disabled
          onChange={jest.fn()}
        >
          Product
        </ToggleCard>
      </form>,
      {wrapper: ThemeWrapper}
    );

    const form = screen.getByRole('form');
    expect(form).toBeValid();
    expect(screen.getByRole('checkbox')).not.toHaveAttribute('name');
    expect(screen.getByRole('checkbox')).not.toBeRequired();
  });

  it('blocks disabled action activation', async () => {
    const onClick = jest.fn();
    render(
      <ToggleCard variant="button" disabled onClick={onClick}>
        Set up manually
      </ToggleCard>,
      {wrapper: ThemeWrapper}
    );

    await userEvent.tab();
    expect(screen.getByRole('button')).toHaveFocus();
    await userEvent.keyboard('{Enter} ');
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });

  it('preserves callback ref cleanup without detaching on state changes', () => {
    const cleanup = jest.fn();
    const ref = jest.fn(() => cleanup);
    const {rerender, unmount} = render(
      <ToggleCard variant="radio" checked={false} onChange={jest.fn()} ref={ref}>
        Option
      </ToggleCard>,
      {wrapper: ThemeWrapper}
    );

    expect(ref).toHaveBeenCalledWith(expect.any(HTMLElement));
    rerender(
      <ToggleCard variant="radio" checked onChange={jest.fn()} ref={ref}>
        Option
      </ToggleCard>
    );
    expect(cleanup).not.toHaveBeenCalled();
    unmount();
    expect(cleanup).toHaveBeenCalledTimes(1);
  });

  it.each([lightTheme, darkTheme])('uses the current theme for its chonk', theme => {
    render(
      <ThemeProvider theme={theme}>
        <ToggleCard
          variant="radio"
          checked={false}
          onChange={jest.fn()}
          data-test-id="card"
        >
          Option
        </ToggleCard>
      </ThemeProvider>
    );

    expect(screen.getByTestId('card')).toHaveStyle({
      '--card-chonk': theme.tokens.interactive.chonky.embossed.neutral.chonk,
    });
  });
});
