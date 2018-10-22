import React from 'react';

import {OrganizationEventsContainer} from 'app/views/organizationEvents';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

import {clearValue, selectByLabel} from '../../../helpers/select';

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
    expect(wrapper.find('Content')).toHaveLength(1);
  });

  it('updates router when changing environments', async function() {
    expect(wrapper.state('environment')).toEqual([]);

    wrapper.find('MultipleEnvironmentSelector .dropdown-actor').simulate('click');
    await tick();
    wrapper.update();

    selectByLabel(wrapper, 'production', {control: true, name: 'environments'});
    // This should update state, but not route or context
    expect(wrapper.state('environment')).toEqual(['production']);

    // Click "Update"
    wrapper.find('Button[data-test-id="update-envs"]').simulate('click');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: ['production'],
      },
    });
    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: ['production']})
    );

    // Select a second environment, "staging"
    selectByLabel(wrapper, 'staging', {control: true, name: 'environments'});
    expect(wrapper.state('environment')).toEqual(['production', 'staging']);

    wrapper.find('Button[data-test-id="update-envs"]').simulate('click');
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: ['production', 'staging'],
      },
    });
    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: ['production', 'staging']})
    );

    // Can clear
    clearValue(wrapper);
    expect(wrapper.state('environment')).toEqual([]);
    wrapper.find('Button[data-test-id="update-envs"]').simulate('click');
    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: []})
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: [],
      },
    });
  });

  it('does not update component state when router is changed', async function() {
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
    expect(wrapper.state('environment')).toEqual([]);

    // This shouldn't happen, we only use URL params for initial state
    wrapper.setProps({
      router: {
        location: {
          pathname: '/organizations/org-slug/events/',
          query: {
            environment: ['production'],
          },
        },
      },
    });
    expect(wrapper.state('environment')).toEqual([]);
  });
});
