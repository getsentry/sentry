import React from 'react';

import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';

import {selectByLabel} from '../../../helpers/select';

describe('MultipleEnvironmentSelector', function() {
  let getMock;
  let wrapper;
  let onChange = jest.fn();
  let onUpdate = jest.fn();
  const organization = TestStubs.Organization({});
  const envs = TestStubs.Environments();
  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  beforeAll(async function() {
    getMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: envs,
    });
    setActiveOrganization(organization);
    await tick();

    wrapper = mount(
      <MultipleEnvironmentSelector
        organization={organization}
        onChange={onChange}
        onUpdate={onUpdate}
      />,
      routerContext
    );
  });

  it('fetches environments only when dropdown opened', async function() {
    expect(getMock).not.toHaveBeenCalled();
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    expect(getMock).toHaveBeenCalled();
    await tick();
    wrapper.update();
    expect(wrapper.find('FetchOrganizationEnvironments')).toHaveLength(1);

    // Close
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    expect(wrapper.find('FetchOrganizationEnvironments')).toHaveLength(0);
  });

  it('can select and change environments', async function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();
    wrapper.update();

    // Select all envs
    envs.forEach(({name}) => {
      selectByLabel(wrapper, name, {control: true});
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(envs.map(({name}) => name));

    wrapper.setProps({value: envs.map(({name}) => name)});
    wrapper.update();
    wrapper.find('Button[data-test-id="update-envs"]').simulate('click');
    await tick();
    wrapper.update();

    expect(onUpdate).toHaveBeenCalledWith(['production', 'staging']);
  });
});
