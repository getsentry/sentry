import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

import {EventTitle} from './eventTitle';

jest.mock('sentry/views/issueDetails/streamline/context');

describe('EventNavigation', () => {
  const testEvent = EventFixture({
    id: 'event-id',
    size: 7,
    dateCreated: '2019-03-20T00:00:00.000Z',
    errors: [],
    entries: [],
    tags: [
      {key: 'environment', value: 'dev'},
      {key: 'replayId', value: 'replay-id'},
    ],
    previousEventID: 'prev-event-id',
    nextEventID: 'next-event-id',
  });
  const defaultProps: React.ComponentProps<typeof EventTitle> = {
    event: testEvent,
    group: GroupFixture({id: 'group-id'}),
  };

  beforeEach(() => {
    jest.resetAllMocks();
    jest.mocked(useIssueDetails).mockReturnValue({
      sectionData: {
        highlights: {key: SectionKey.HIGHLIGHTS},
        tags: {key: SectionKey.TAGS},
        replay: {key: SectionKey.REPLAY},
      },
      detectorDetails: {},
      eventCount: 0,
      isSidebarOpen: true,
      navScrollMargin: 0,
      dispatch: jest.fn(),
    });
    Object.assign(navigator, {
      clipboard: {writeText: jest.fn().mockResolvedValue('')},
    });
    window.open = jest.fn();

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/actionable-items/`,
      body: {
        errors: [],
      },
      method: 'GET',
    });
  });

  it('does not show jump to sections by default', () => {
    jest.mocked(useIssueDetails).mockReturnValue({
      sectionData: {},
      detectorDetails: {},
      eventCount: 0,
      isSidebarOpen: true,
      navScrollMargin: 0,
      dispatch: jest.fn(),
    });
    render(<EventTitle {...defaultProps} />);
    expect(screen.queryByText('Jump To:')).not.toBeInTheDocument();
    expect(screen.queryByText('Replay')).not.toBeInTheDocument();
    expect(screen.queryByText('Tags')).not.toBeInTheDocument();
    expect(screen.queryByText('Highlights')).not.toBeInTheDocument();
  });

  it('does show jump to sections when the sections render', () => {
    render(<EventTitle {...defaultProps} />);
    expect(screen.getByText('Jump to:')).toBeInTheDocument();
    expect(screen.getByText('Highlights')).toBeInTheDocument();
    expect(screen.getByText('Replay')).toBeInTheDocument();
    expect(screen.getByText('Tags')).toBeInTheDocument();
  });

  it('can copy event ID', async () => {
    render(<EventTitle {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy Event ID'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);
  });

  it('shows event actions dropdown', async () => {
    render(<EventTitle {...defaultProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy Event ID'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(testEvent.id);

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Copy Event Link'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/group-id/events/event-id/`
    );

    await userEvent.click(screen.getByRole('button', {name: 'Event actions'}));
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'View JSON'}));

    expect(window.open).toHaveBeenCalledWith(
      `https://us.sentry.io/api/0/projects/org-slug/project-slug/events/event-id/json/`
    );
  });

  it('shows processing issue button if there is an event error', async () => {
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/actionable-items/`,
      body: {
        errors: [
          {
            type: 'invalid_data',
            data: {
              name: 'logentry',
            },
            message: 'no message present',
          },
        ],
      },
      method: 'GET',
    });
    render(<EventTitle {...defaultProps} />);

    expect(
      await screen.findByRole('button', {name: 'Processing Error'})
    ).toBeInTheDocument();
  });
});
