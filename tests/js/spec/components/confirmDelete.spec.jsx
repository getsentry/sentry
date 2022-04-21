import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import ConfirmDelete from 'sentry/components/confirmDelete';

describe('ConfirmDelete', function () {
  it('renders', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    // jest had an issue rendering root component snapshot so using ModalDialog instead
    expect(modal.find('Modal')).toSnapshot();
  });

  it('confirm button is disabled and bypass prop is false when modal opens', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );

    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    expect(wrapper.find('Confirm').prop('bypass')).toBe(false);
    expect(modal.find('Button[priority="primary"][disabled=true]').exists()).toBe(true);
  });

  it('confirm button stays disabled with non-matching input', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    modal.find('input').simulate('change', {target: {value: 'Cool'}});
    expect(modal.find('Button[priority="primary"][disabled=true]').exists()).toBe(true);
  });

  it('confirm button is enabled when confirm input matches', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ConfirmDelete message="Are you sure?" onConfirm={mock} confirmInput="CoolOrg">
        <button>Confirm?</button>
      </ConfirmDelete>
    );
    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    modal.find('input').simulate('change', {target: {value: 'CoolOrg'}});
    expect(modal.find('Button[priority="primary"][disabled=false]').exists()).toBe(true);

    modal.find('Button[priority="primary"]').simulate('click');

    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });
});
