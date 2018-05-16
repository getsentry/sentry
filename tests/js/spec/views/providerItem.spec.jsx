import React from 'react';
import {shallow, mount} from 'enzyme';

import ProviderItem from 'app/views/settings/organizationAuth/providerItem';

describe('ProviderItem', function() {
  it('renders', function() {
    let wrapper = shallow(
      <ProviderItem providerKey="dummy" providerName="Dummy" onConfigure={() => {}} />,
      TestStubs.routerContext()
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('calls configure callback', function() {
    let mock = jest.fn();
    let wrapper = mount(
      <ProviderItem providerKey="dummy" providerName="Dummy" onConfigure={mock} />,
      TestStubs.routerContext()
    );

    wrapper.find('Button').simulate('click');
    expect(mock).toHaveBeenCalledWith('dummy', expect.anything());
  });
});
