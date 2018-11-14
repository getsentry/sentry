import React from 'react';
import {mount} from 'enzyme';

import {OrganizationEvents} from 'app/views/organizationEvents/events';

jest.mock('app/utils/withLatestContext');

describe('OrganizationEventsErrors', function() {
  const project = TestStubs.Project({isMember: true});
  const org = TestStubs.Organization({projects: [project]});
  let eventsMock;
  let eventsStatsMock;

  beforeEach(function() {
    // Search bar makes this request when mounted
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      body: [{count: 1, tag: 'transaction'}, {count: 2, tag: 'mechanism'}],
    });
    eventsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events/',
      body: (url, opts) => [TestStubs.OrganizationEvent(opts.query)],
    });
    eventsStatsMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/events-stats/',
      body: (url, opts) => {
        return TestStubs.HealthGraph(opts.query);
      },
    });
  });

  it('renders events table', async function() {
    let wrapper = mount(
      <OrganizationEvents organization={org} location={{query: {}}} />,
      TestStubs.routerContext()
    );
    await tick();
    wrapper.update();
    expect(eventsStatsMock).toHaveBeenCalled();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
    expect(wrapper.find('IdBadge')).toHaveLength(2);
  });

  // This tests the component's `shouldComponentUpdate`
  // Use `search` to compare instead of `query` because that's what we check in `AsyncComponent`
  it('location.query changes updates events table', async function() {
    let wrapper = mount(
      <OrganizationEvents
        organization={org}
        location={{
          search: '?statsPeriod=14d',
          query: {
            statsPeriod: '14d',
          },
        }}
      />,
      TestStubs.routerContext()
    );

    expect(eventsMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        query: {
          statsPeriod: '14d',
        },
      })
    );

    eventsMock.mockClear();

    wrapper.setProps({
      location: {
        query: {
          start: '2017-10-01T04:00:00',
          end: '2017-10-02T03:59:59',
        },
        search: '?start=2017-10-01T04:00:00&end=2017-10-02T03:59:59',
      },
    });
    wrapper.update();

    expect(eventsMock).toHaveBeenLastCalledWith(
      expect.any(String),
      expect.objectContaining({
        query: {
          start: '2017-10-01T04:00:00',
          end: '2017-10-02T03:59:59',
        },
      })
    );
  });
});
