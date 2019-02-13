import React from 'react';
import {mount} from 'enzyme';

import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';
import withOrganizationEnvironments from 'app/utils/withOrganizationEnvironments';

describe('withOrganizationEnvironments HoC', function() {
  const envs = TestStubs.Environments();
  beforeEach(() => {
    OrganizationEnvironmentsStore.init();
    OrganizationEnvironmentsStore.loadInitialData(envs);
  });

  it('forwards organization environments as props', function() {
    const MyComponent = () => null;
    const Container = withOrganizationEnvironments(MyComponent);
    const wrapper = mount(<Container />);

    expect(wrapper.find('MyComponent').prop('organizationEnvironments')).toHaveLength(2);

    const firstEnvironment = wrapper
      .find('MyComponent')
      .prop('organizationEnvironments')[0];

    expect(firstEnvironment).toEqual(
      expect.objectContaining({
        name: 'production',
        displayName: 'Production',
      })
    );
  });
});
