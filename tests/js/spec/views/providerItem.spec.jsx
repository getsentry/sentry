import {mountWithTheme} from 'sentry-test/enzyme';

import {descopeFeatureName} from 'app/utils';
import ProviderItem from 'app/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function () {
  const provider = TestStubs.AuthProviders()[0];
  const org = TestStubs.Organization({
    features: [descopeFeatureName(provider.requiredFeature)],
  });
  const routerContext = TestStubs.routerContext([{organization: org}]);

  it('renders', function () {
    const wrapper = mountWithTheme(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      routerContext
    );

    expect(wrapper.find('ProviderDescription').text()).toContain(
      'Enable your organization to sign in with Dummy.'
    );
    expect(wrapper.find('Tag').exists()).toBe(false);
  });

  it('calls configure callback', function () {
    const mock = jest.fn();
    const wrapper = mountWithTheme(
      <ProviderItem organization={org} provider={provider} onConfigure={mock} />,
      routerContext
    );

    wrapper.find('Button').simulate('click');
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });

  it('renders a disabled Tag when disabled', function () {
    const noFeatureRouterContext = TestStubs.routerContext();
    const wrapper = mountWithTheme(
      <ProviderItem organization={org} provider={provider} onConfigure={() => {}} />,
      noFeatureRouterContext
    );

    expect(wrapper.find('Tag').exists()).toBe(true);
    expect(wrapper.find('Tag').text()).toBe('disabled');
  });
});
