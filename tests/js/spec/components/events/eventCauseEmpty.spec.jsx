import moment from 'moment';

import {mountWithTheme} from 'sentry-test/enzyme';

import EventCauseEmpty from 'sentry/components/events/eventCauseEmpty';
import {trackAnalyticsEventV2} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('EventCauseEmpty', function () {
  let putMock;

  const organization = TestStubs.Organization();
  const project = TestStubs.Project({
    platform: 'javascript',
    firstEvent: '2020-01-01T23:54:33.831199Z',
  });
  const event = TestStubs.Event();

  beforeEach(function () {
    jest.clearAllMocks();

    MockApiClient.clearMockResponses();

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/completion/',
      body: [{step: 'commit', complete: false}],
    });
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {},
    });
    putMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: '/prompts-activity/',
    });
  });

  it('renders', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(true);

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.viewed',
      eventName: null,
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });

  /**
   * Want to alternate between showing the configure suspect commits prompt and
   * the show configure distributed tracing prompt.
   */
  it('doesnt render when event id starts with even char', async function () {
    const newEvent = {
      ...event,
      id: 'A',
      eventID: 'ABCDEFABCDEFABCDEFABCDEFABCDEFAB',
    };
    const wrapper = mountWithTheme(
      <EventCauseEmpty event={newEvent} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);
    expect(trackAnalyticsEventV2).not.toHaveBeenCalled();
  });

  it('can be snoozed', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    wrapper.find('button[aria-label="Snooze"]').first().simulate('click');

    await tick();
    await wrapper.update();

    expect(putMock).toHaveBeenCalledWith(
      '/prompts-activity/',
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

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.snoozed',
      eventName: 'Event Cause Snoozed',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });

  it('does not render when snoozed', async function () {
    const snoozed_ts = moment().subtract(1, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);
  });

  it('renders when snoozed more than 7 days ago', async function () {
    const snoozed_ts = moment().subtract(9, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {snoozed_ts}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(true);
  });

  it('can be dismissed', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    wrapper.find('button[aria-label="Dismiss"]').first().simulate('click');

    await tick();
    await wrapper.update();

    expect(putMock).toHaveBeenCalledWith(
      '/prompts-activity/',
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

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.dismissed',
      eventName: 'Event Cause Dismissed',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });

  it('does not render when dismissed', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleCommitPanel').exists()).toBe(false);
  });

  it('can capture analytics on docs click', async function () {
    const wrapper = mountWithTheme(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    await tick();
    wrapper.update();

    wrapper.find('[aria-label="Read the docs"]').first().simulate('click');

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.docs_clicked',
      eventName: 'Event Cause Docs Clicked',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });
});
