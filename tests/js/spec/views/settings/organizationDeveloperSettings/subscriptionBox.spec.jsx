/*global global*/
import React from 'react';

import {mount} from 'enzyme';
import SubscriptionBox from 'app/views/settings/organizationDeveloperSettings/subscriptionBox';

describe('SubscriptionBox', () => {
  let wrapper;
  let onChange;

  beforeEach(() => {
    onChange = jest.fn();
    wrapper = mount(
      <SubscriptionBox
        resource={'issue'}
        checked={false}
        disabled={false}
        onChange={onChange}
      />,
      TestStubs.routerContext()
    );
  });

  it('renders resource checkbox', () => {
    expect(wrapper).toMatchSnapshot();
  });

  it('updates state and calls onChange prop when checking checkbox', () => {
    wrapper.find('Checkbox input').simulate('change', {target: {checked: true}});
    expect(wrapper.state('checked')).toBe(true);
    expect(onChange).toHaveBeenCalledWith('issue', true);
  });

  it('renders tooltip when checkbox is disabled', () => {
    wrapper.setProps({disabled: true});
    expect(wrapper.find('Tooltip').prop('disabled')).toBe(false);
  });
});
