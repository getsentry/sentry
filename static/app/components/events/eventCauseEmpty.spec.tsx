import moment from 'moment';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import EventCauseEmpty from 'sentry/components/events/eventCauseEmpty';
import {trackAnalyticsEventV2} from 'sentry/utils/analytics';

jest.mock('sentry/utils/analytics');

describe('EventCauseEmpty', function () {
  let putMock: undefined | ReturnType<typeof MockApiClient.addMockResponse> = undefined;

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

  it('renders', async function async() {
    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    expect(
      await screen.findByRole('heading', {name: 'Configure Suspect Commits'})
    ).toBeInTheDocument();

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
  it('doesnt render when event id starts with even char', function () {
    const newEvent = {
      ...event,
      id: 'A',
      eventID: 'ABCDEFABCDEFABCDEFABCDEFABCDEFAB',
    };

    render(
      <EventCauseEmpty event={newEvent} organization={organization} project={project} />
    );

    expect(
      screen.queryByRole('heading', {name: 'Configure Suspect Commits'})
    ).not.toBeInTheDocument();

    expect(trackAnalyticsEventV2).not.toHaveBeenCalled();
  });

  it('can be snoozed', async function () {
    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    userEvent.click(await screen.findByRole('button', {name: 'Snooze'}));

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

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Configure Suspect Commits'})
      ).not.toBeInTheDocument();
    });

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.snoozed',
      eventName: 'Event Cause Snoozed',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });

  it('does not render when snoozed', function () {
    const snoozed_ts = moment().subtract(1, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {snoozed_ts}},
    });

    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    expect(
      screen.queryByRole('heading', {name: 'Configure Suspect Commits'})
    ).not.toBeInTheDocument();
  });

  it('renders when snoozed more than 7 days ago', async function () {
    const snoozed_ts = moment().subtract(9, 'day').unix();

    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {snoozed_ts}},
    });

    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    expect(
      await screen.findByRole('heading', {name: 'Configure Suspect Commits'})
    ).toBeInTheDocument();
  });

  it('can be dismissed', async function () {
    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    userEvent.click(await screen.findByRole('button', {name: 'Dismiss'}));

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

    await waitFor(() => {
      expect(
        screen.queryByRole('heading', {name: 'Configure Suspect Commits'})
      ).not.toBeInTheDocument();
    });

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.dismissed',
      eventName: 'Event Cause Dismissed',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });

  it('does not render when dismissed', function () {
    MockApiClient.addMockResponse({
      method: 'GET',
      url: '/prompts-activity/',
      body: {data: {dismissed_ts: moment().unix()}},
    });

    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    expect(
      screen.queryByRole('heading', {name: 'Configure Suspect Commits'})
    ).not.toBeInTheDocument();
  });

  it('can capture analytics on docs click', async function () {
    render(
      <EventCauseEmpty event={event} organization={organization} project={project} />
    );

    userEvent.click(await screen.findByRole('button', {name: 'Read the docs'}));

    expect(trackAnalyticsEventV2).toHaveBeenCalledWith({
      eventKey: 'event_cause.docs_clicked',
      eventName: 'Event Cause Docs Clicked',
      organization,
      project_id: project.id,
      platform: project.platform,
    });
  });
});
