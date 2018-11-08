import React from 'react';

import {OrganizationHealth} from 'app/views/organizationHealth';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

describe('OrganizationHealth', function() {
  let wrapper;
  const router = TestStubs.router({
    location: {
      pathname: '/organizations/org-slug/health/',
      query: {},
    },
  });
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
      <OrganizationHealth router={router} organization={organization}>
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

  it('updates component state when router is updated', async function() {
    wrapper = mount(
      <OrganizationHealth router={router} organization={organization}>
        <div />
      </OrganizationHealth>,
      TestStubs.routerContext([
        {
          organization,
        },
      ])
    );
    expect(wrapper.state('environments')).toEqual([]);

    wrapper.setProps({
      router: {
        location: {
          pathname: '/organizations/org-slug/health/',
          query: {
            environments: ['production'],
          },
        },
      },
    });
    expect(wrapper.state('environments')).toEqual(['production']);

    wrapper.setProps({
      router: {
        location: {
          pathname: '/organizations/org-slug/health/',
          query: {
            environments: ['production', 'staging'],
          },
        },
      },
    });
    expect(wrapper.state('environments')).toEqual(['production', 'staging']);
  });
});
