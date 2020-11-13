import React from 'react';
import moment from 'moment';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventCauseEmpty from 'app/components/events/eventCauseEmpty';
import {trackAdhocEvent, trackAnalyticsEvent} from 'app/utils/analytics';

jest.mock('app/utils/analytics');

describe('EventCauseEmpty', function () {
  let putMock;
  const routerContext = TestStubs.routerContext();
  const organization = TestStubs.Organization();
  const project = TestStubs.Project({
    platform: 'javascript',
    firstEvent: '2020-01-01T23:54:33.831199Z',
  });

  beforeEach(function () {
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

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(true);

    expect(trackAdhocEvent).toHaveBeenCalledWith({
      eventKey: 'event_cause.viewed',
      org_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  });

  it('can be snoozed', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('button[aria-label="Snooze"]').first().simulate('click');

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

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'event_cause.snoozed',
      eventName: 'Event Cause Snoozed',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  });

  it('does not render when snoozed', async function () {
    const snoozed_ts = moment().subtract(1, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);
  });

  it('renders when snoozed more than 7 days ago', async function () {
    const snoozed_ts = moment().subtract(9, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(true);
  });

  it('can be dismissed', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('button[aria-label="Dismiss"]').first().simulate('click');

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

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'event_cause.dismissed',
      eventName: 'Event Cause Dismissed',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  });

  it('does not render when dismissed', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/promptsactivity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);
  });

  it('can capture analytics on docs click', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty organization={organization} project={project} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('[aria-label="Read the docs"]').first().simulate('click');

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'event_cause.docs_clicked',
      eventName: 'Event Cause Docs Clicked',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(project.id, 10),
      platform: project.platform,
    });
  });
});
