import React from 'react';
import {shallow, mount} from 'enzyme';
import GlobalModal from 'app/components/globalModal';
import {openModal, closeModal} from 'app/actionCreators/modal';

describe('GlobalModal', function() {
  it('renders', function() {
    let wrapper = shallow(<GlobalModal />);
    expect(wrapper).toMatchSnapshot();
  });

  it('uses actionCreators to open and close Modal', function(done) {
    let wrapper = mount(<GlobalModal />);

    openModal(() => <div id="modal-test">Hi</div>);

    // async :<
    setTimeout(() => {
      wrapper.update();
      let modal = $(document.body).find('.modal');
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
});
