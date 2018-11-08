import React from 'react';

import {OrganizationEventsContainer} from 'app/views/organizationEvents';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

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
    expect(wrapper.state('environment')).toEqual([]);

    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();
    wrapper.update();

    wrapper
      .find('EnvironmentSelectorItem')
      .at(0)
      .simulate('click');
    // This should update state, but not route or context
    expect(wrapper.state('environment')).toEqual(['production']);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: ['production'],
        statsPeriod: '14d',
      },
    });
    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: ['production']})
    );

    // Select a second environment, "staging"
    await wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    wrapper.update();
    wrapper
      .find('EnvironmentSelectorItem')
      .at(1)
      .find('MultiSelect')
      .simulate('click');
    // selectByLabel(wrapper, 'staging', {control: true, name: 'environments'});
    expect(wrapper.state('environment')).toEqual(['production', 'staging']);

    // close dropdown
    await wrapper
      .find('MultipleEnvironmentSelector')
      .instance()
      .doUpdate();
    wrapper.update();
    expect(router.push).toHaveBeenLastCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: ['production', 'staging'],
        statsPeriod: '14d',
      },
    });
    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: ['production', 'staging']})
    );

    // Can clear
    wrapper.find('MultipleEnvironmentSelector HeaderItem').simulate('click');
    await tick();
    wrapper.update();
    wrapper.find('MultipleEnvironmentSelector HeaderItem StyledClose').simulate('click');
    expect(wrapper.state('environment')).toEqual([]);

    expect(wrapper.state('queryValues')).toEqual(
      expect.objectContaining({environment: []})
    );
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        environment: [],
        statsPeriod: '14d',
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
            statsPeriod: '14d',
          },
        },
      },
    });
    expect(wrapper.state('environment')).toEqual([]);
  });
});
