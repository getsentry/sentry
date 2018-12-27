import React from 'react';

import {descopeFeatureName} from 'app/utils';
import {mount} from 'enzyme';
import ProviderItem from 'app/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function() {
  const provider = TestStubs.AuthProviders()[0];
  const org = TestStubs.Organization({
    features: [descopeFeatureName(provider.requiredFeature)],
  });
  const routerContext = TestStubs.routerContext([{organization: org}]);

  it('renders', function() {
    let wrapper = mount(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      routerContext
    );

    expect(wrapper.find('ProviderDescription').text()).toContain(
      'Enable your organization to sign in with Dummy.'
    );
    expect(wrapper.find('Tag').exists()).toBe(false);
  });

  it('calls configure callback', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ProviderItem organization={org} provider={provider} onConfigure={mock} />,
      routerContext
    );

    wrapper.find('Button').simulate('click');
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });

  it('renders a disabled Tag when disabled', function() {
    const noFeatureRouterContext = TestStubs.routerContext();
    let wrapper = mount(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      noFeatureRouterContext
    );

    expect(wrapper.find('Tag').exists()).toBe(true);
    expect(wrapper.find('Tag').text()).toBe('disabled');
  });
});
