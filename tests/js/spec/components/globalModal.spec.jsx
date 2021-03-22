import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import {closeModal, openModal} from 'app/actionCreators/modal';
import GlobalModal from 'app/components/globalModal';

describe('GlobalModal', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(<GlobalModal />);
    wrapper.unmount();
  });

  it('uses actionCreators to open and close Modal', async function () {
    const wrapper = mountWithTheme(<GlobalModal />);

    openModal(() => <div id="modal-test">Hi</div>);

    const modal = await mountGlobalModal();
    expect(modal.text()).toBe('Hi');

    wrapper.update();
    expect(wrapper.find('GlobalModal').prop('visible')).toBe(true);

    closeModal();
    await tick();
    wrapper.update();

    expect(wrapper.find('GlobalModal').prop('visible')).toBe(false);
  });

  it('calls onClose handler when modal is clicked out of', async function () {
    const wrapper = mountWithTheme(<GlobalModal />);
    const closeSpy = jest.fn();

    openModal(
      ({Header}) => (
        <div id="modal-test">
          <Header closeButton>Header</Header>Hi
        </div>
      ),
      {onClose: closeSpy}
    );

    const modal = await mountGlobalModal();

    modal.find('CloseButton').simulate('click');
    await tick();
    wrapper.update();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', async function () {
    const wrapper = mountWithTheme(<GlobalModal />);
    const closeSpy = jest.fn();

    openModal(({closeModal: cm}) => <button onClick={cm} />, {onClose: closeSpy});

    await tick();

    wrapper.update();
    wrapper.find('button').simulate('click');

    await tick();

    wrapper.update();
    expect(closeSpy).toHaveBeenCalled();
  });
});
