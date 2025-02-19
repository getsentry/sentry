import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';

import {EventTitle, ORDERED_SECTIONS} from './eventTitle';

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
      activeSection: null,
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
      activeSection: null,
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

describe('EventNavigationLink highlighting', () => {
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

  let mockDispatch: jest.Mock;
  const originalOrderedSections = [...ORDERED_SECTIONS];

  beforeEach(() => {
    jest.resetAllMocks();
    mockDispatch = jest.fn();
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
      activeSection: null,
      dispatch: mockDispatch,
    });

    // Create the section elements in the DOM in the correct order
    [SectionKey.HIGHLIGHTS, SectionKey.TAGS, SectionKey.REPLAY].forEach(key => {
      const div = document.createElement('div');
      div.id = key;
      document.body.appendChild(div);
    });

    // Mock window.innerHeight and scrollY for bottom detection
    Object.defineProperty(window, 'innerHeight', {value: 800, configurable: true});
    Object.defineProperty(window, 'scrollY', {value: 0, configurable: true});
    Object.defineProperty(document.documentElement, 'scrollHeight', {
      value: 2000,
      configurable: true,
    });

    // Mock getBoundingClientRect for section positioning
    Element.prototype.getBoundingClientRect = jest.fn().mockReturnValue({
      top: 200,
      bottom: 400,
    });

    // Mock API response
    MockApiClient.addMockResponse({
      url: `/projects/org-slug/project-slug/events/event-id/actionable-items/`,
      body: {
        errors: [],
      },
      method: 'GET',
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    document.body.innerHTML = '';
    MockApiClient.clearMockResponses();
    mockDispatch.mockClear();
    // Restore original ORDERED_SECTIONS
    ORDERED_SECTIONS.length = 0;
    ORDERED_SECTIONS.push(...originalOrderedSections);
  });

  it('highlights section closest to activation offset', async () => {
    const {rerender} = render(<EventTitle {...defaultProps} />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Highlights'})).toBeInTheDocument();
    });

    // Mock Highlights section being closest to activation offset
    Element.prototype.getBoundingClientRect = jest.fn().mockImplementation(function (
      this: Element
    ) {
      type TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: number};
        [SectionKey.TAGS]: {top: number};
        [SectionKey.REPLAY]: {top: number};
      };
      const positions: TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: 98}, // Closest to 100px offset
        [SectionKey.TAGS]: {top: 300},
        [SectionKey.REPLAY]: {top: 500},
      };
      return positions[this.id as keyof TestSections] || {top: 0};
    });

    // Trigger scroll event
    window.dispatchEvent(new Event('scroll'));

    // Verify dispatch was called with Highlights as active
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION_VISIBILITY',
      sectionId: SectionKey.HIGHLIGHTS,
      ratio: 1,
    });

    // Update context to reflect the active section
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
      activeSection: SectionKey.HIGHLIGHTS,
      dispatch: mockDispatch,
    });

    // Re-render to reflect context changes
    rerender(<EventTitle {...defaultProps} />);

    // Verify the highlight is applied
    const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
    expect(highlightsLink).toHaveAttribute('data-active', 'true');
  });

  it('highlights last section when near bottom of page', async () => {
    // Mock ORDERED_SECTIONS to have Replay as the last section
    ORDERED_SECTIONS.length = 0;
    ORDERED_SECTIONS.push(SectionKey.HIGHLIGHTS, SectionKey.TAGS, SectionKey.REPLAY);

    // Mock useIssueDetails to return sections in the correct order
    jest.mocked(useIssueDetails).mockReturnValue({
      sectionData: {
        highlights: {key: SectionKey.HIGHLIGHTS},
        tags: {key: SectionKey.TAGS},
        replay: {key: SectionKey.REPLAY}, // Replay is last
      },
      detectorDetails: {},
      eventCount: 0,
      isSidebarOpen: true,
      navScrollMargin: 0,
      activeSection: null,
      dispatch: mockDispatch,
    });

    const {rerender} = render(<EventTitle {...defaultProps} />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Replay'})).toBeInTheDocument();
    });

    // Mock being near bottom of page
    Object.defineProperty(window, 'innerHeight', {value: 800});
    Object.defineProperty(window, 'scrollY', {value: 1970});
    Object.defineProperty(document.documentElement, 'scrollHeight', {value: 2000});

    // Mock section positions
    Element.prototype.getBoundingClientRect = jest.fn().mockImplementation(function (
      this: Element
    ) {
      type TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: number};
        [SectionKey.TAGS]: {top: number};
        [SectionKey.REPLAY]: {top: number};
      };
      const positions: TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: 1500},
        [SectionKey.TAGS]: {top: 1700},
        [SectionKey.REPLAY]: {top: 1900},
      };
      return positions[this.id as keyof TestSections] || {top: 0};
    });

    // Clear any previous dispatch calls
    mockDispatch.mockClear();

    // Trigger scroll event
    window.dispatchEvent(new Event('scroll'));

    // Verify dispatch was called with last section (Replay) as active
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION_VISIBILITY',
      sectionId: SectionKey.REPLAY,
      ratio: 1,
    });

    // Update context to reflect the active section
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
      activeSection: SectionKey.REPLAY,
      dispatch: mockDispatch,
    });

    // Re-render to reflect context changes
    rerender(<EventTitle {...defaultProps} />);

    // Verify the last section is highlighted
    const replayLink = screen.getByRole('button', {name: 'Replay'});
    expect(replayLink).toHaveAttribute('data-active', 'true');
  });

  it('updates highlight when scrolling to different section', async () => {
    const {rerender} = render(<EventTitle {...defaultProps} />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Tags'})).toBeInTheDocument();
    });

    // Mock Tags section being closest to activation offset
    Element.prototype.getBoundingClientRect = jest.fn().mockImplementation(function (
      this: Element
    ) {
      type TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: number};
        [SectionKey.TAGS]: {top: number};
        [SectionKey.REPLAY]: {top: number};
      };
      const positions: TestSections = {
        [SectionKey.HIGHLIGHTS]: {top: 300},
        [SectionKey.TAGS]: {top: 102}, // Closest to 100px offset
        [SectionKey.REPLAY]: {top: 500},
      };
      return positions[this.id as keyof TestSections] || {top: 0};
    });

    // Trigger scroll event
    window.dispatchEvent(new Event('scroll'));

    // Verify dispatch was called with Tags as active
    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION_VISIBILITY',
      sectionId: SectionKey.TAGS,
      ratio: 1,
    });

    // Update context to reflect the active section
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
      activeSection: SectionKey.TAGS,
      dispatch: mockDispatch,
    });

    // Re-render to reflect context changes
    rerender(<EventTitle {...defaultProps} />);

    // Verify Tags link is highlighted
    const tagsLink = screen.getByRole('button', {name: 'Tags'});
    expect(tagsLink).toHaveAttribute('data-active', 'true');

    const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
    const replayLink = screen.getByRole('button', {name: 'Replay'});
    expect(highlightsLink).toHaveAttribute('data-active', 'false');
    expect(replayLink).toHaveAttribute('data-active', 'false');
  });
});
