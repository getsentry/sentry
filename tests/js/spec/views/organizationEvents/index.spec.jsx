import React from 'react';

import {OrganizationEventsContainer} from 'app/views/organizationEvents';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

import {selectByLabel} from '../../../helpers/select';

describe('OrganizationEvents', function() {
  let wrapper;
  const router = TestStubs.router({
    location: {
      pathname: '/organizations/org-slug/events/',
      query: {},
    },
  });
  const project = TestStubs.Project({isMember: true});
  const organization = TestStubs.Organization({
    features: ['events-stream'],
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
      <OrganizationEventsContainer router={router} organization={organization}>
        <div />
      </OrganizationEventsContainer>,
      TestStubs.routerContext([
        {
          organization,
        },
      ])
    );
  });

  it('renders', function() {
    expect(wrapper.find('OrganizationEventsContent')).toHaveLength(1);
  });

  it('updates router when changing environments', async function() {
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'production', {control: true, name: 'environments'});
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environments: ['production'],
      },
    });
    selectByLabel(wrapper, 'staging', {control: true, name: 'environments'});
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environments: ['production', 'staging'],
      },
    });
  });

  it('updates component state when router is updated', async function() {
    wrapper = mount(
      <OrganizationEventsContainer router={router} organization={organization}>
        <div />
      </OrganizationEventsContainer>,
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
          pathname: '/organizations/org-slug/events/',
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
          pathname: '/organizations/org-slug/events/',
          query: {
            environments: ['production', 'staging'],
          },
        },
      },
    });
    expect(wrapper.state('environments')).toEqual(['production', 'staging']);
  });
});
