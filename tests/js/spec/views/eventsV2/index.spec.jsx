import React from 'react';
import {mountWithTheme} from 'sentry-test/enzyme';

import {initializeOrg} from 'sentry-test/initializeOrg';

import {DiscoverLanding} from 'app/views/eventsV2/landing';

const FIELDS = [
  {
    field: 'title',
    title: 'Custom Title',
  },
  {
    field: 'timestamp',
    title: 'Custom Time',
  },
  {
    field: 'user',
    title: 'Custom User',
  },
];

const generateFields = () => {
  return {
    fieldnames: FIELDS.map(i => i.title),
    field: FIELDS.map(i => i.field),
  };
};

describe('EventsV2', function() {
  const eventTitle = 'Oh no something bad';
  const features = ['events-v2'];

  beforeEach(function() {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/eventsv2/',
      body: {
        meta: {
          id: 'string',
          title: 'string',
          'project.name': 'string',
          timestamp: 'date',
          'user.id': 'string',
        },
        data: [
          {
            id: 'deadbeef',
            'user.id': 'alberto leal',
            title: eventTitle,
            'project.name': 'project-slug',
            timestamp: '2019-05-23T22:12:48+00:00',
          },
        ],
      },
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/project-slug:deadbeef/',
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

  it('renders a link list', function() {
    /* TODO(leedongwei)
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features, projects: [TestStubs.Project()]})}
        location={{query: {}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('Events');
    expect(content.find('LinkContainer').length).toBeGreaterThanOrEqual(3);
    */
  });

  it('renders a list of events', function() {
    /* TODO(leedongwei)
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features, projects: [TestStubs.Project()]})}
        location={{query: {...generateFields()}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );
    const content = wrapper.find('PageContent');
    expect(content.find('Events PanelHeaderCell').length).toBeGreaterThan(0);
    expect(content.find('Events PanelItemCell').length).toBeGreaterThan(0);
    */
  });

  it('handles no projects', function() {
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features})}
        location={{query: {...generateFields()}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const content = wrapper.find('PageContent');
    expect(content.text()).toContain('You need at least one project to use this view');
  });

  it('generates an active sort link based on default sort', function() {
    /* TODO(leedongwei)
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features, projects: [TestStubs.Project()]})}
        location={{query: {...generateFields(), sort: ['-timestamp']}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const findLink = sortKey =>
      wrapper
        .find('Table SortLink')
        .find({sortKey})
        .find('StyledLink');

    const timestamp = findLink('timestamp');

    // Sort should be active
    expect(
      timestamp
        .find('InlineSvg')
        .first()
        .props().src
    ).toEqual('icon-chevron-down');

    // Sort link should reverse.
    expect(timestamp.props().to.query).toEqual({
      ...generateFields(),
      sort: 'timestamp',
    });

    const userlink = findLink('user.id');

    // User link should be descending.
    expect(userlink.props().to.query).toEqual({
      ...generateFields(),
      sort: '-user.id',
    });
    */
  });

  it('generates links to modals', async function() {
    /* TODO(leedongwei)
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={TestStubs.Organization({features, projects: [TestStubs.Project()]})}
        location={{query: {...generateFields()}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const link = wrapper.find(`Table Link[aria-label="${eventTitle}"]`).first();
    expect(link.props().to.query).toEqual({
      eventSlug: 'project-slug:deadbeef',
      ...generateFields(),
    });
    */
  });

  it('opens a modal when eventSlug is present', async function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });
    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={organization}
        params={{orgId: organization.slug}}
        location={{query: {eventSlug: 'project-slug:deadbeef'}}}
        router={{}}
      />,
      TestStubs.routerContext()
    );

    const modal = wrapper.find('EventDetails');
    expect(modal).toHaveLength(1);
  });

  it.only('pagination cursor should be cleared when making a search', function() {
    const organization = TestStubs.Organization({
      features,
      projects: [TestStubs.Project()],
    });

    const initialData = initializeOrg({
      organization,
      router: {
        location: {query: {...generateFields(), cursor: '0%3A50%3A0'}},
      },
    });

    const wrapper = mountWithTheme(
      <DiscoverLanding
        organization={organization}
        params={{orgId: organization.slug}}
        location={initialData.router.location}
        router={initialData.router}
      />,
      initialData.routerContext
    );

    // ensure cursor query string is initially present in the location

    expect(initialData.router.location).toEqual({
      query: {
        ...generateFields(),
        cursor: '0%3A50%3A0',
      },
    });

    // perform a search

    const search = wrapper.find('#smart-search-input').first();

    search.simulate('change', {target: {value: 'geo:canada'}}).simulate('submit', {
      preventDefault() {},
    });

    // cursor query string should be omitted from the query string

    expect(initialData.router.push).toHaveBeenCalledWith({
      pathname: undefined,
      query: {
        ...generateFields(),
        query: 'geo:canada',
        statsPeriod: '14d',
      },
    });
  });
});
