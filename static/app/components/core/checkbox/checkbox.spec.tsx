import {useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {getEmotionRules} from 'sentry-test/utils';

import {Checkbox} from '@sentry/scraps/checkbox';

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
  it.each([
    [{}, 'block'],
    [{disabled: true}, 'none'],
    [{readOnly: true}, 'none'],
  ])('only shows interaction feedback when editable with %j', (props, display) => {
    render(<Checkbox {...props} onChange={jest.fn()} />);

    const wrapper = screen.getByRole('checkbox').parentElement!;
    const rules = getEmotionRules(wrapper).join('');
    expect(rules).toMatch(new RegExp(`::after\\s*\\{[^}]*display:\\s*${display}`));
    expect(rules).toMatch(/:hover::after\s*\{[^}]*opacity:\s*0\.06/);
    expect(rules).toMatch(/:active::after\s*\{[^}]*opacity:\s*0\.09/);
    expect(rules).toMatch(
      /:has\(input:checked,\s*input:indeterminate\):hover::after\s*\{[^}]*opacity:\s*0\.085/
    );
    expect(rules).toMatch(
      /:has\(input:checked,\s*input:indeterminate\):active::after\s*\{[^}]*opacity:\s*0\.12/
    );
  });

  it('default is unchecked', () => {
    render(<Checkbox onChange={jest.fn()} />);

    expect(screen.getByRole('checkbox')).not.toBeChecked();
  });

  it('checked', () => {
    render(<Checkbox checked onChange={jest.fn()} />);
    expect(screen.getByRole('checkbox')).toBeChecked();
  });

  it('indeterminate', () => {
    render(<Checkbox checked="indeterminate" onChange={jest.fn()} />);
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
      </label>
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
    render(<Checkbox disabled aria-label="Enable feature" tooltipProps={tooltipProps} />);

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
      />
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
      </form>
    );

    const form = screen.getByRole<HTMLFormElement>('form', {name: 'Settings'});
    expect(new FormData(form).has('enabled')).toBe(false);
    expect(form.checkValidity()).toBe(true);
  });

  describe('controlled checkbox', () => {
    it('toggles on click', async () => {
      render(<ControlledCheckbox />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
      await userEvent.click(screen.getByLabelText('Custom Label'));
      expect(screen.getByRole('checkbox')).toBeChecked();
    });
  });

  // @TODO(jonasbadalic): Checkbox should support uncontrolled state
});
