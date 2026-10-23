import type * as React from 'react';
import {useState} from 'react';
import {ThemeProvider} from '@emotion/react';
import {render, screen} from '@testing-library/react';
import {userEvent} from '@testing-library/user-event';

import {Checkbox} from '@sentry/scraps/checkbox';
import {lightTheme} from '@sentry/scraps/theme';

function ControlledCheckbox() {
  const [checked, setChecked] = useState(false);

  return (
    <label>
      <Checkbox checked={checked} onChange={e => setChecked(e.target.checked)} />
      Custom Label
    </label>
  );
}

describe('Checkbox', () => {
  it('default is unchecked', () => {
    render(<Checkbox onChange={jest.fn()} />, {wrapper: ThemeWrapper});

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('checked', () => {
    render(<Checkbox checked onChange={jest.fn()} />, {wrapper: ThemeWrapper});
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('indeterminate', () => {
    render(<Checkbox checked="indeterminate" onChange={jest.fn()} />, {
      wrapper: ThemeWrapper,
    });
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole('checkbox')).not.toBeChecked();
    expect(screen.getByRole<HTMLInputElement>('checkbox').indeterminate).toBe(true);
  });

  it('shows a disabled reason on keyboard focus without allowing changes', async () => {
    const onChange = jest.fn();
    const onClick = jest.fn();
    const onClickCapture = jest.fn();
    const onKeyDown = jest.fn();
    render(
      <label>
        <Checkbox
          disabled
          onChange={onChange}
          onClick={onClick}
          onClickCapture={onClickCapture}
          onKeyDown={onKeyDown}
          tooltipProps={{title: 'Requires admin access'}}
        />
        Enable feature
      </label>,
      {wrapper: ThemeWrapper}
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'});
    expect(checkbox).toHaveAttribute('aria-disabled', 'true');

    await userEvent.tab();
    expect(checkbox).toHaveFocus();
    expect(await screen.findByText('Requires admin access')).toBeInTheDocument();
    expect(checkbox).toHaveAccessibleDescription('Requires admin access');

    await userEvent.keyboard(' ');
    await userEvent.keyboard('{Enter}');
    await userEvent.click(checkbox);
    await userEvent.click(screen.getByText('Enable feature'));
    expect(checkbox).not.toBeChecked();
    expect(onChange).not.toHaveBeenCalled();
    expect(onClick).not.toHaveBeenCalled();
    expect(onClickCapture).not.toHaveBeenCalled();
    expect(onKeyDown).not.toHaveBeenCalled();
  });

  it.each([
    ['no tooltip is present', undefined],
    ['the tooltip is disabled', {title: 'Requires admin access', disabled: true}],
  ])('uses native disabled when %s', (_, tooltipProps) => {
    render(
      <Checkbox disabled aria-label="Enable feature" tooltipProps={tooltipProps} />,
      {wrapper: ThemeWrapper}
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'});
    expect(checkbox).toBeDisabled();
    expect(checkbox).not.toHaveAttribute('aria-disabled');
  });

  it('shows a tooltip without disabling an enabled checkbox', async () => {
    const onChange = jest.fn();
    const onKeyDown = jest.fn();
    render(
      <Checkbox
        aria-label="Enable feature"
        onChange={onChange}
        onKeyDown={onKeyDown}
        tooltipProps={{title: 'Enable this feature'}}
      />,
      {wrapper: ThemeWrapper}
    );

    const checkbox = screen.getByRole('checkbox', {name: 'Enable feature'});
    await userEvent.tab();
    expect(await screen.findByText('Enable this feature')).toBeInTheDocument();
    expect(checkbox).toHaveAccessibleDescription('Enable this feature');
    await userEvent.keyboard(' ');

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onKeyDown).toHaveBeenCalledTimes(1);
  });

  it('excludes a disabled checkbox with a tooltip from form data and validation', () => {
    render(
      <form aria-label="Settings">
        <Checkbox
          checked
          disabled
          name="enabled"
          tooltipProps={{title: 'Requires admin access'}}
        />
        <Checkbox
          disabled
          name="requiredChoice"
          required
          tooltipProps={{title: 'Requires admin access'}}
        />
      </form>,
      {wrapper: ThemeWrapper}
    );

    const form = screen.getByRole<HTMLFormElement>('form', {name: 'Settings'});
    expect(new FormData(form).has('enabled')).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });

  describe('controlled checkbox', () => {
    it('toggles on click', async () => {
      render(<ControlledCheckbox />, {wrapper: ThemeWrapper});

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(screen.getByLabelText('Custom Label'));
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  // @TODO(jonasbadalic): Checkbox should support uncontrolled state
});

function ThemeWrapper({children}: {children: React.ReactNode}) {
  return <ThemeProvider theme={lightTheme}>{children}</ThemeProvider>;
}
