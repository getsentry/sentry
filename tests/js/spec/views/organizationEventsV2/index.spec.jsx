import React from 'react';
import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import OrganizationEventsV2 from 'app/views/organizationEventsV2';

describe('OrganizationEventsV2', function() {
  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: [
        {
          id: 'deadbeef',
          title: 'Oh no something bad',
          'project.name': 'project-slug',
          timestamp: '2019-05-23T22:12:48+00:00',
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/deadbeef/',
      method: 'GET',
      body: {
        id: '1234',
        size: 1200,
        eventID: 'deadbeef',
        title: 'Oh no something bad',
        message: 'It was not good',
        dateCreated: '2019-05-23T22:12:48+00:00',
        entries: [
          {
            type: 'message',
            message: 'bad stuff',
            data: {},
          },
        ],
        tags: [{key: 'browser', value: 'Firefox'}],
      },
    });
  });

  it('renders', function() {
    const wrapper = mount(
      <OrganizationEventsV2
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        location={{query: {}}}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('Events');
  });

  it('handles no projects', function() {
    const wrapper = mount(
      <OrganizationEventsV2
        organization={TestStubs.Organization()}
        location={{query: {}}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('generates links to modals', async function() {
    const wrapper = mount(
      <OrganizationEventsV2
        organization={TestStubs.Organization({projects: [TestStubs.Project()]})}
        location={{query: {}}}
      />,
      TestStubs.routerContext()
    );

    const link = wrapper.find('Table Link[data-test-id="event-title"]').first();
    expect(link.props().to.query).toEqual({eventSlug: 'project-slug:deadbeef'});
  });

  it('opens a modal when eventSlug is present', async function() {
    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    const wrapper = mount(
      <OrganizationEventsV2
        organization={organization}
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        params={{orgId: organization.slug}}
      />,
      TestStubs.routerContext()
    );

    const modal = wrapper.find('EventDetails');
    expect(modal).toHaveLength(1);
  });

  it('navigates when tag values are clicked', async function() {
    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    const wrapper = mount(
      <OrganizationEventsV2
        organization={organization}
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {eventSlug: 'project-slug:deadbeef'},
        }}
        params={{orgId: organization.slug}}
      />,
      TestStubs.routerContext()
    );
    await tick();
    await wrapper.update();

    const tagValue = wrapper.find('EventDetails TagsTable TagValue a');
    expect(tagValue).toHaveLength(1);

    tagValue.simulate('click');
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/events/',
        query: {query: 'browser:"Firefox"'},
      })
    );
  });

  it('appends tag value to existing query when clicked', async function() {
    const organization = TestStubs.Organization({projects: [TestStubs.Project()]});
    const wrapper = mount(
      <OrganizationEventsV2
        organization={organization}
        location={{
          pathname: '/organizations/org-slug/events/',
          query: {
            query: 'Dumpster',
            eventSlug: 'project-slug:deadbeef',
          },
        }}
        params={{orgId: organization.slug}}
      />,
      TestStubs.routerContext()
    );
    await tick();
    await wrapper.update();

    const tagValue = wrapper.find('EventDetails TagsTable TagValue a');
    expect(tagValue).toHaveLength(1);

    tagValue.simulate('click');
    // Should remove eventSlug and append new tag value causing
    // the view to re-render
    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        pathname: '/organizations/org-slug/events/',
        query: {query: 'Dumpster browser:"Firefox"'},
      })
    );
  });
});
