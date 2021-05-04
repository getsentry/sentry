import moment from 'moment';

import {mountWithTheme} from 'sentry-test/enzyme';

import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventQuickTrace from 'app/views/organizationGroupDetails/eventQuickTrace';

jest.mock('app/utils/analytics');

describe('EventQuickTrace', function () {
  let putMock;
  const routerContext = TestStubs.routerContext();
  const organization = TestStubs.Organization();
  const group = TestStubs.Group();
  const event = {
    ...TestStubs.Event(),
    id: '2',
    eventID: '21098765432109876543210987654321',
  };

  beforeEach(function () {
    jest.clearAllMocks();

    MockApiClient.clearMockResponses();

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
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(true);
  });

  /**
   * Want to alternate between showing the configure suspect commits prompt and
   * the show configure distributed tracing prompt.
   */
  it('doesnt render when event id starts with odd char', async function () {
    const newEvent = {
      ...event,
      id: 'B',
      eventID: 'BAFEDCBAFEDCBAFEDCBAFEDCBAFEDCBA',
    };
    const wrapper = mountWithTheme(
      <EventQuickTrace event={newEvent} organization={organization} group={group} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);
  });

  it('doesnt render when the project platform doesnt support tracing', async function () {
    const newGroup = {
      ...group,
      project: {
        ...group.project,
        platform: '',
      },
    };
    const wrapper = mountWithTheme(
      <EventQuickTrace event={event} organization={organization} group={newGroup} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);
  });

  it('can be snoozed', async function () {
    const wrapper = mountWithTheme(
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
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
          project_id: group.project.id,
          feature: 'distributed_tracing',
          status: 'snoozed',
        },
      })
    );

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'quick_trace.missing_instrumentation.snoozed',
      eventName: 'Quick Trace: Missing Instrumentation Snoozed',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(group.project.id, 10),
      platform: group.project.platform,
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
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);
  });

  it('can be dismissed', async function () {
    const wrapper = mountWithTheme(
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
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
          project_id: group.project.id,
          feature: 'distributed_tracing',
          status: 'dismissed',
        },
      })
    );

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'quick_trace.missing_instrumentation.dismissed',
      eventName: 'Quick Trace: Missing Instrumentation Dismissed',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(group.project.id, 10),
      platform: group.project.platform,
    });
  });

  it('does not render when dismissed', async function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    const wrapper = mountWithTheme(
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
    );

    await tick();
    wrapper.update();

    expect(wrapper.find('ExampleQuickTracePanel').exists()).toBe(false);
  });

  it('can capture analytics on docs click', async function () {
    const wrapper = mountWithTheme(
      <EventQuickTrace event={event} organization={organization} group={group} />,
      routerContext
    );

    await tick();
    wrapper.update();

    wrapper.find('[aria-label="Read the docs"]').first().simulate('click');

    expect(trackAnalyticsEvent).toHaveBeenCalledWith({
      eventKey: 'quick_trace.missing_instrumentation.docs',
      eventName: 'Quick Trace: Missing Instrumentation Docs',
      organization_id: parseInt(organization.id, 10),
      project_id: parseInt(group.project.id, 10),
      platform: group.project.platform,
    });
  });
});
