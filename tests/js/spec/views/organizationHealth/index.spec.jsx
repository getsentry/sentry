import React from 'react';

import {OrganizationHealth} from 'app/views/organizationHealth';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

import {selectByLabel} from '../../../helpers/select';

describe('OrganizationHealth', function() {
  let wrapper;
  const project = TestStubs.Project({isMember: true});
  const organization = TestStubs.Organization({
    features: ['health'],
    projects: [project],
  });

  beforeAll(async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });

    setActiveOrganization(organization);
    await tick();

    wrapper = mount(
      <OrganizationHealth organization={organization}>
        <div />
      </OrganizationHealth>,
      TestStubs.routerContext([
        {
          organization,
        },
      ])
    );
  });

  it('renders', function() {
    expect(wrapper.find('HealthWrapper')).toHaveLength(1);
  });

  it('changes environments', async function() {
    wrapper.find('MultipleEnvironmentSelector .dropdown-actor').simulate('click');
    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'production', {control: true, name: 'environments'});
    expect(wrapper.state('params').environments).toEqual(['1']);
    selectByLabel(wrapper, 'staging', {control: true, name: 'environments'});
    expect(wrapper.state('params').environments).toEqual(['1', '2']);
  });
});
