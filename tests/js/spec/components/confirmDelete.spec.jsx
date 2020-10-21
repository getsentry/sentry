import {mountWithTheme} from 'sentry-test/enzyme';

import ConfirmDelete from 'app/components/confirmDelete';

describe('ConfirmDelete', function () {
  it('renders', function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    wrapper.find('button').simulate('click');
    // jest had an issue rendering root component snapshot so using ModalDialog instead
    expect(wrapper.find('ModalDialog')).toSnapshot();
  });

  it('confirm button is disabled and bypass prop is false when modal opens', function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );

    wrapper.find('button').simulate('click');

    expect(wrapper.find('Confirm').prop('bypass')).toBe(false);
    expect(wrapper.state('disableConfirmButton')).toBe(true);
  });

  it('confirm button stays disabled with non-matching input', function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    wrapper.find('button').simulate('click');
    wrapper.find('input').simulate('change', {target: {value: 'Cool'}});
    expect(wrapper.find('Confirm').prop('disableConfirmButton')).toBe(true);
  });

  it('confirm button is enabled when confirm input matches', function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>,
      TestStubs.routerContext()
    );
    wrapper.find('button').simulate('click');
    wrapper.find('input').simulate('change', {target: {value: 'CoolOrg'}});
    expect(wrapper.find('Confirm').prop('disableConfirmButton')).toBe(false);

    wrapper.find('Button').last().simulate('click');

    expect(wrapper.find('Modal').first().prop('show')).toBe(false);
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });
});
