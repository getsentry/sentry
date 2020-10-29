import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import FeatureTourModal from 'app/components/modals/featureTourModal';
import GlobalModal from 'app/components/globalModal';

const steps = [
  {
    title: 'First',
    body: 'First step',
    image: <em data-test-id="step-image">Image</em>,
    actions: (
      <a href="#" data-test-id="step-action">
        additional action
      </a>
    ),
  },
  {title: 'Second', body: 'Second step'},
];

describe('FeatureTourModal', function () {
  let onAdvance, onCloseModal;

  const createWrapper = (props = {}) =>
    mountWithTheme(
      <React.Fragment>
        <GlobalModal />
        <FeatureTourModal
          steps={steps}
          onAdvance={onAdvance}
          onCloseModal={onCloseModal}
          {...props}
        >
          {({showModal}) => (
            <a href="#" onClick={showModal} data-test-id="reveal">
              Open
            </a>
          )}
        </FeatureTourModal>
      </React.Fragment>
    );

  const showModal = async wrapper => {
    wrapper.find('[data-test-id="reveal"]').simulate('click');
    await tick();
    wrapper.update();
  };

  beforeEach(function () {
    onAdvance = jest.fn();
    onCloseModal = jest.fn();
  });

  it('shows the modal on click', async function () {
    const wrapper = createWrapper();

    // No modal showing
    expect(wrapper.find('GlobalModal').props().visible).toEqual(false);
    await showModal(wrapper);

    // Modal is now showing
    expect(wrapper.find('GlobalModal').props().visible).toEqual(true);
  });

  it('advances on click', async function () {
    const wrapper = createWrapper();

    await showModal(wrapper);

    // Should start on the first step.
    expect(wrapper.find('TourHeader h4').text()).toEqual(steps[0].title);

    // Advance to the next step.
    wrapper.find('Button[data-test-id="next-step"]').simulate('click');

    // Should move to next step.
    expect(wrapper.find('TourHeader h4').text()).toEqual(steps[1].title);
    expect(onAdvance).toHaveBeenCalled();
  });

  it('shows step content', async function () {
    const wrapper = createWrapper();

    await showModal(wrapper);

    // Should show title, image and actions
    expect(wrapper.find('TourHeader h4').text()).toEqual(steps[0].title);
    expect(wrapper.find('TourContent em[data-test-id="step-image"]')).toHaveLength(1);
    expect(wrapper.find('TourContent a[data-test-id="step-action"]')).toHaveLength(1);
    expect(wrapper.find('StepCounter').text()).toEqual('1 of 2');
  });

  it('last step shows done', async function () {
    const wrapper = createWrapper();

    await showModal(wrapper);

    // Advance to the the last step.
    wrapper.find('Button[data-test-id="next-step"]').simulate('click');

    // Click the done
    wrapper.find('Button[data-test-id="complete-tour"]').simulate('click');

    // Wait for the ModalStore action to propagate.
    await tick();
    expect(onAdvance).toHaveBeenCalledTimes(1);
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('last step shows doneText and uses doneUrl', async function () {
    const props = {doneText: 'Finished', doneUrl: 'http://example.org'};
    const wrapper = createWrapper(props);

    await showModal(wrapper);

    // Advance to the the last step.
    wrapper.find('Button[data-test-id="next-step"]').simulate('click');

    // Ensure button looks right
    const button = wrapper.find('Button[data-test-id="complete-tour"]');
    expect(button.text()).toEqual(props.doneText);
    expect(button.props().href).toEqual(props.doneUrl);

    // Click the done
    button.simulate('click');
    // Wait for the ModalStore action to propagate.
    await tick();
    expect(onCloseModal).toHaveBeenCalledTimes(1);
  });

  it('close button dismisses modal', async function () {
    const wrapper = createWrapper();

    await showModal(wrapper);

    wrapper.find('CloseButton').simulate('click');

    // Wait for the ModalStore action to propagate.
    await tick();
    expect(onCloseModal).toHaveBeenCalled();
  });
});
