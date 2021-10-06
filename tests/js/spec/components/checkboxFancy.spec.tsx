import {mountWithTheme} from 'sentry-test/reactTestingLibrary';

import CheckboxFancy from 'app/components/checkboxFancy/checkboxFancy';

describe('CheckboxFancy', function () {
  it('renders', function () {
    const {container} = mountWithTheme(<CheckboxFancy />);
    expect(container).toSnapshot();
  });

  it('isChecked', function () {
    const wrapper = mountWithTheme(<CheckboxFancy isChecked />);
    expect(wrapper.getByRole('checkbox', {checked: true})).toBeTruthy();
    expect(wrapper.getByTestId('icon-check-mark')).toBeInTheDocument();
    expect(wrapper.queryByTestId('icon-subtract')).toBeNull();
  });

  it('isIndeterminate', function () {
    const wrapper = mountWithTheme(<CheckboxFancy isIndeterminate />);
    expect(wrapper.getByRole('checkbox')).toHaveAttribute('aria-checked', 'mixed');
    expect(wrapper.queryByTestId('icon-check-mark')).toBeNull();
    expect(wrapper.getByTestId('icon-subtract')).toBeInTheDocument();
  });

  it('isDisabled', function () {
    const wrapper = mountWithTheme(<CheckboxFancy isDisabled />);
    expect(wrapper.getByRole('checkbox')).toHaveAttribute('aria-disabled', 'true');
    expect(wrapper.queryByTestId('icon-check-mark')).toBeNull();
    expect(wrapper.queryByTestId('icon-subtract')).toBeNull();
  });
});
