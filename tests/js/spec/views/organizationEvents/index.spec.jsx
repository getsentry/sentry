import React from 'react';

import {OrganizationEventsContainer} from 'app/views/organizationEvents';
import {mount} from 'enzyme';
import {setActiveOrganization} from 'app/actionCreators/organizations';

describe('OrganizationEvents', function() {
  let wrapper;
  let router;
  const project = TestStubs.Project({isMember: true});
  const organization = TestStubs.Organization({
    features: ['events-stream'],
    projects: [project, TestStubs.Project({isMember: true, slug: 'new-project', id: 3})],
  });

  beforeAll(async function() {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: TestStubs.Environments(),
    });

    setActiveOrganization(organization);
    await tick();
  });

  beforeEach(function() {
    router = TestStubs.router({
      location: {
        pathname: '/organizations/org-slug/events/',
        query: {},
      },
    });

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
    expect(wrapper.state('environment')).toEqual([]);

    // This shouldn't happen, we only use URL params for initial state
    wrapper.setProps({
      router: {
        ...router,
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

  it('updates router when changing projects', function() {
    expect(wrapper.state('project')).toEqual([]);

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    wrapper
      .find('MultipleProjectSelector AutoCompleteItem')
      .at(0)
      .simulate('click');
    expect(wrapper.state('project')).toEqual([2]);

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        project: [2],
        statsPeriod: '14d',
      },
    });
  });

  it('selects multiple projects', async function() {
    expect(wrapper.state('project')).toEqual([]);

    wrapper.find('MultipleProjectSelector HeaderItem').simulate('click');

    wrapper
      .find('MultipleProjectSelector AutoCompleteItem MultiSelectWrapper')
      .at(0)
      .simulate('click');
    expect(wrapper.state('project')).toEqual([2]);

    wrapper
      .find('MultipleProjectSelector AutoCompleteItem MultiSelectWrapper')
      .at(1)
      .simulate('click');
    expect(wrapper.state('project')).toEqual([2, 3]);

    wrapper.find('MultipleProjectSelector StyledChevron').simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        project: [2, 3],
        statsPeriod: '14d',
      },
    });
  });

  it('changes to absolute time (utc is default)', async function() {
    const start = new Date('2017-10-01T00:00:00.000Z');
    const end = new Date('2017-10-01T23:59:59.000Z');

    wrapper.find('TimeRangeSelector HeaderItem').simulate('click');

    await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

    // Oct 1st
    wrapper
      .find('DayCell')
      .at(0)
      .simulate('mouseUp');

    expect(wrapper.state('period')).toEqual(null);
    expect(wrapper.state('start')).toEqual(start);
    expect(wrapper.state('end')).toEqual(end);

    wrapper.find('TimeRangeSelector StyledChevron').simulate('click');

    expect(router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/events/',
      query: {
        start: '2017-10-01T00:00:00',
        end: '2017-10-01T23:59:59',
        utc: true,
      },
    });
  });
});
