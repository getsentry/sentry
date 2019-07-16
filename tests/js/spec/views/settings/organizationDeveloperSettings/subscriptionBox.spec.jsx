import React from 'react';

import {mount} from 'enzyme';
import {SubscriptionBox} from 'app/views/settings/organizationDeveloperSettings/subscriptionBox';

describe('SubscriptionBox', () => {
  let wrapper;
  let onChange;
  let org = TestStubs.Organization();

  beforeEach(() => {
    onChange = jest.fn();
    wrapper = mount(
      <SubscriptionBox
        resource="issue"
        checked={false}
        disabled={false}
        onChange={onChange}
        organization={org}
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

  describe('error.created resource subscription', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mount(
        <SubscriptionBox
          resource="error"
          checked={false}
          disabled={false}
          onChange={onChange}
          organization={org}
        />,
        TestStubs.routerContext()
      );
    });

    it('checkbox disabled without integrations-event-hooks flag', () => {
      expect(wrapper.find('Checkbox').prop('disabled')).toBe(true);
    });

    it('tooltip enabled without integrations-event-hooks flag', () => {
      expect(wrapper.find('Tooltip').prop('disabled')).toBe(false);
    });

    it('checkbox visible with integrations-event-hooks flag', () => {
      org = TestStubs.Organization({features: ['integrations-event-hooks']});
      wrapper = mount(
        <SubscriptionBox
          resource="error"
          checked={false}
          disabled={false}
          onChange={onChange}
          organization={org}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper.find('Checkbox').prop('disabled')).toBe(false);
    });

    it('Tooltip disabled with integrations-event-hooks flag', () => {
      org = TestStubs.Organization({features: ['integrations-event-hooks']});
      wrapper = mount(
        <SubscriptionBox
          resource="error"
          checked={false}
          disabled={false}
          onChange={onChange}
          organization={org}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper.find('Tooltip').prop('disabled')).toBe(true);
    });
  });
});
