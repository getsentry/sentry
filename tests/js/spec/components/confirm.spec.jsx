import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import Confirm from 'sentry/components/confirm';

describe('Confirm', function () {
  it('renders', function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(wrapper).toSnapshot();
  });

  it('renders custom confirm button & callbacks work', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Confirm
        message="Are you sure?"
        onConfirm={mock}
        renderConfirmButton={({defaultOnClick}) => (
          <button data-test-id="confirm-btn" onClick={defaultOnClick}>
            Confirm Button
          </button>
        )}
      >
        <button data-test-id="trigger-btn">Confirm?</button>
      </Confirm>
    );
    wrapper.find('button[data-test-id="trigger-btn"]').simulate('click');
    const modal = await mountGlobalModal();

    const confirmBtn = modal.find('button[data-test-id="confirm-btn"]');
    expect(confirmBtn.exists()).toBe(true);

    expect(mock).not.toHaveBeenCalled();
    confirmBtn.simulate('click');
    expect(mock).toHaveBeenCalled();
  });
  it('renders custom cancel button & callbacks work', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Confirm
        message="Are you sure?"
        onCancel={mock}
        renderCancelButton={({defaultOnClick}) => (
          <button data-test-id="cancel-btn" onClick={defaultOnClick}>
            Cancel Button
          </button>
        )}
      >
        <button data-test-id="trigger-btn">Confirm?</button>
      </Confirm>
    );
    wrapper.find('button[data-test-id="trigger-btn"]').simulate('click');
    const modal = await mountGlobalModal();

    const cancelBtn = modal.find('button[data-test-id="cancel-btn"]');
    expect(cancelBtn.exists()).toBe(true);

    expect(mock).not.toHaveBeenCalled();
    cancelBtn.simulate('click');
    expect(mock).toHaveBeenCalled();
  });
  it('clicking action button opens Modal', async function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    expect(modal.find('GlobalModal[visible=true]').exists()).toBe(true);
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    // Click "Confirm" button, should be last button
    modal.find('Button').last().simulate('click');

    await tick();
    modal.update();

    expect(modal.find('GlobalModal[visible=true]').exists()).toBe(false);
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('can stop propagation on the event', function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock} stopPropagation>
        <button>Confirm?</button>
      </Confirm>
    );

    expect(mock).not.toHaveBeenCalled();

    const event = {
      stopPropagation: jest.fn(),
    };

    wrapper.find('button').simulate('click', event);
    wrapper.update();

    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
  });
});
