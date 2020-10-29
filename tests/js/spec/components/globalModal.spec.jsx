import React from 'react';

import {mountWithTheme, mount} from 'sentry-test/enzyme';

import GlobalModal from 'app/components/globalModal';
import {openModal, closeModal} from 'app/actionCreators/modal';

describe('GlobalModal', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(<GlobalModal />);
    expect(wrapper).toSnapshot();
    wrapper.unmount();
  });

  it('uses actionCreators to open and close Modal', function (done) {
    const wrapper = mount(<GlobalModal />);

    openModal(() => <div id="modal-test">Hi</div>);

    // async :<
    setTimeout(() => {
      wrapper.update();
      const modal = $(document.body).find('.modal');
      expect(modal.text()).toBe('Hi');
      expect(wrapper.find('GlobalModal').prop('visible')).toBe(true);

      closeModal();
      setTimeout(() => {
        wrapper.update();
        expect(wrapper.find('GlobalModal').prop('visible')).toBe(false);
        done();
      }, 1);
    }, 1);
  });

  it('calls onClose handler when modal is clicked out of', async function () {
    const wrapper = mount(<GlobalModal />);
    const closeSpy = jest.fn();

    openModal(
      ({Header}) => (
        <div id="modal-test">
          <Header closeButton>Header</Header>Hi
        </div>
      ),
      {onClose: closeSpy}
    );

    await tick();

    wrapper.update();
    $(document.body).find('.modal .close').click();

    await tick();

    wrapper.update();
    expect(closeSpy).toHaveBeenCalled();
  });

  it('calls onClose handler when closeModal prop is called', async function () {
    const wrapper = mount(<GlobalModal />);
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
