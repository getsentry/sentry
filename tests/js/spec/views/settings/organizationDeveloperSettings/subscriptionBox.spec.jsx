import {mount} from 'sentry-test/enzyme';

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
        disabledFromPermissions={false}
        onChange={onChange}
        organization={org}
      />,
      TestStubs.routerContext()
    );
  });

  it('renders resource checkbox', () => {
    expect(wrapper).toSnapshot();
  });

  it('calls onChange prop when checking checkbox', () => {
    wrapper.find('Checkbox input').simulate('change', {target: {checked: true}});
    expect(onChange).toHaveBeenCalledWith('issue', true);
  });

  it('renders tooltip when checkbox is disabled', () => {
    wrapper.setProps({disabledFromPermissions: true});
    expect(wrapper.find('Tooltip').prop('disabled')).toBe(false);
  });

  describe('error.created resource subscription', () => {
    beforeEach(() => {
      onChange = jest.fn();
      wrapper = mount(
        <SubscriptionBox
          resource="error"
          checked={false}
          disabledFromPermissions={false}
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
          disabledFromPermissions={false}
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
          disabledFromPermissions={false}
          onChange={onChange}
          organization={org}
        />,
        TestStubs.routerContext()
      );
      expect(wrapper.find('Tooltip').prop('disabled')).toBe(true);
    });
  });

  it('disables checkbox when webhookDisabled=true', () => {
    wrapper = mount(
      <SubscriptionBox
        resource="issue"
        checked={false}
        disabledFromPermissions={false}
        webhookDisabled
        onChange={onChange}
        organization={org}
      />,
      TestStubs.routerContext()
    );
    const tooltip = wrapper.find('Tooltip');
    expect(tooltip.prop('disabled')).toBe(false);
    expect(tooltip.prop('title')).toBe(
      'Cannot enable webhook subscription without specifying a webhook url'
    );
    expect(wrapper.find('Checkbox').prop('disabled')).toBe(true);
  });
});
