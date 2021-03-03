import React from 'react';

import {mountWithTheme, shallow} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import Confirm from 'app/components/confirm';

describe('Confirm', function () {
  it('renders', function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    expect(wrapper).toSnapshot();
  });

  it('clicking action button opens Modal', async function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    expect(modal.find('Modal[show=true]').exists()).toBe(true);
  });

  it('clicks Confirm in modal and calls `onConfirm` callback', async function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <Confirm message="Are you sure?" onConfirm={mock}>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
    );

    expect(mock).not.toHaveBeenCalled();

    wrapper.find('button').simulate('click');

    const modal = await mountGlobalModal();

    // Click "Confirm" button, should be last button
    modal.find('Button').last().simulate('click');

    await tick();
    modal.update();

    expect(modal.find('Modal[show=true]').exists()).toBe(false);
    expect(mock).toHaveBeenCalled();
    expect(mock.mock.calls).toHaveLength(1);
  });

  it('can stop propagation on the event', function () {
    const mock = jest.fn();
    const wrapper = shallow(
      <Confirm message="Are you sure?" onConfirm={mock} stopPropagation>
        <button>Confirm?</button>
      </Confirm>,
      TestStubs.routerContext()
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
