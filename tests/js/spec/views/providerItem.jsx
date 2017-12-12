import React from 'react';
import {shallow, mount} from 'enzyme';

import ProviderItem from 'app/views/settings/organization/auth/providerItem';

describe('ProviderItem', function() {
  it('renders', function() {
    let wrapper = shallow(
      <ProviderItem providerKey="dummy" providerName="Dummy" onConfigure={() => {}} />
    );

    expect(wrapper).toMatchSnapshot();
  });

  it('calls configure callback', function() {
    let mock = jest.fn();
    mount(<ProviderItem providerKey="dummy" providerName="Dummy" onConfigure={mock} />);

    expect(mock).toHaveBeenCalledWith('dummy');
  });
});
