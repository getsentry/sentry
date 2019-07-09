import React from 'react';
import moment from 'moment';
import {mount} from 'enzyme';

import EventCauseEmpty from 'app/components/events/eventCauseEmpty';

describe('EventCauseEmpty', function() {
  let putMock;
  const routerContext = TestStubs.routerContext();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project();

  beforeEach(function() {
    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [{step: 'commit', complete: false}],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {},
    });
    putMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/promptsactivity/',
    });
  });

  it('renders', function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.find('CommitRow').exists()).toBe(true);
  });

  it('can be snoozed', function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    wrapper
      .find('[data-test-id="snoozed"]')
      .first()
      .simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/promptsactivity/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          organization_id: organization.id,
          project_id: project.id,
          feature: 'suspect_commits',
          status: 'snoozed',
        },
      })
    );

    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });

  it('does not render when snoozed', function() {
    const snoozed_ts = moment()
      .subtract(1, 'day')
      .unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });

  it('renders when snoozed more than 3 days ago', function() {
    const snoozed_ts = moment()
      .subtract(5, 'day')
      .unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.find('CommitRow').exists()).toBe(true);
  });

  it('can be dismissed', function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    wrapper
      .find('[data-test-id="dismissed"]')
      .first()
      .simulate('click');

    expect(putMock).toHaveBeenCalledWith(
      '/promptsactivity/',
      expect.objectContaining({
        method: 'PUT',
        data: {
          organization_id: organization.id,
          project_id: project.id,
          feature: 'suspect_commits',
          status: 'dismissed',
        },
      })
    );

    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });

  it('does not render when dismissed', function() {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: Date.now() / 1000}},
    });

    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );
    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });
});
