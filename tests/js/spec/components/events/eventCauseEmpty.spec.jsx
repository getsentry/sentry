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

  it('renders', async function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow').exists()).toBe(true);
  });

  it('can be snoozed', async function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

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

  it('does not render when snoozed', async function() {
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

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });

  it('renders when snoozed more than 7 days ago', async function() {
    const snoozed_ts = moment()
      .subtract(9, 'day')
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

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow').exists()).toBe(true);
  });

  it('can be dismissed', async function() {
    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

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

  it('does not render when dismissed', async function() {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    const wrapper = mount(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('CommitRow').exists()).toBe(false);
  });
});
