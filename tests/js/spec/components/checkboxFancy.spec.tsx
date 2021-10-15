import {mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

describe('CheckboxFancy', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<CheckboxFancy />);
    expect(container).toSnapshot();
  });

  it('isChecked', function () {
    mountWithTheme(<CheckboxFancy isChecked />);
    expect(screen.getByRole('checkbox', {checked: true})).toBeTruthy();
    expect(screen.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-subtract')).toBeNull();
  });

  it('isIndeterminate', function () {
    mountWithTheme(<CheckboxFancy isIndeterminate />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    expect(screen.queryByTestId('icon-check-mark')).toBeNull();
    expect(screen.getByTestId('icon-subtract')).toBeInTheDocument();
  });

  it('isDisabled', function () {
    mountWithTheme(<CheckboxFancy isDisabled />);
    expect(screen.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    expect(screen.queryByTestId('icon-check-mark')).toBeNull();
    expect(screen.queryByTestId('icon-subtract')).toBeNull();
  });
});
