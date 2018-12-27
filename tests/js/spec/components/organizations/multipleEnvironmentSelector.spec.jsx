import React from 'react';

import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import MultipleEnvironmentSelector from 'app/components/organizations/multipleEnvironmentSelector';

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
  });

  beforeEach(function() {
    onChange.mockReset();
    onUpdate.mockReset();
    wrapper = mount(
      <MultipleEnvironmentSelector
        organization={organization}
        onChange={onChange}
        onUpdate={onUpdate}
      />,
      routerContext
    );
  });

  it('fetches environments when mounting', async function() {
    expect(getMock).toHaveBeenCalled();
    await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.update();
    expect(wrapper.find('FetchOrganizationEnvironments')).toHaveLength(1);

    // Close
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    expect(wrapper.find('FetchOrganizationEnvironments')).toHaveLength(1);

    wrapper.unmount();
    expect(getMock).toHaveBeenCalledTimes(1);
  });

  it('can select and change environments', async function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');

    // Select all envs
    envs.forEach((env, i) => {
      wrapper
        .find('EnvironmentSelectorItem')
        .at(i)
        .find('MultiSelect')
        .simulate('click', {});
    });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      envs.map(({name}) => name),
      expect.anything()
    );

    wrapper.setProps({value: envs.map(({name}) => name)});
    wrapper.update();
    wrapper
      .find('MultipleEnvironmentSelector')
      .instance()
      .doUpdate();
    expect(onUpdate).toHaveBeenCalledWith();
  });

  it('selects multiple environments and uses chevron to update', async function() {
    await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');

    await wrapper
      .find('MultipleEnvironmentSelector AutoCompleteItem MultiSelectWrapper')
      .at(0)
      .simulate('click');

    expect(onChange).toHaveBeenLastCalledWith(['production'], expect.anything());

    wrapper
      .find('MultipleEnvironmentSelector AutoCompleteItem MultiSelectWrapper')
      .at(1)
      .simulate('click');
    expect(onChange).toHaveBeenLastCalledWith(
      ['production', 'staging'],
      expect.anything()
    );

    wrapper.find('MultipleEnvironmentSelector StyledChevron').simulate('click');
    expect(onUpdate).toHaveBeenCalledWith();
  });

  it('does not update when there are no changes', async function() {
    await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.find('MultipleEnvironmentSelector StyledChevron').simulate('click');
    expect(onUpdate).not.toHaveBeenCalled();
  });
});
