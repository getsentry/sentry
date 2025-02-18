import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

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
      activeSection: null,
      sectionVisibility: {},
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
      sectionVisibility: {},
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
      sectionVisibility: {},
      dispatch: mockDispatch,
    });

    // Create the section elements in the DOM
    const highlightsDiv = document.createElement('div');
    highlightsDiv.id = SectionKey.HIGHLIGHTS;
    document.body.appendChild(highlightsDiv);

    const tagsDiv = document.createElement('div');
    tagsDiv.id = SectionKey.TAGS;
    document.body.appendChild(tagsDiv);

    const replayDiv = document.createElement('div');
    replayDiv.id = SectionKey.REPLAY;
    document.body.appendChild(replayDiv);

    window.IntersectionObserver = class {
      callback: IntersectionObserverCallback;
      elements: Set<Element>;
      root: Element | null;
      rootMargin: string;
      thresholds: number[];
      options: IntersectionObserverInit;

      constructor(cb: IntersectionObserverCallback, options?: IntersectionObserverInit) {
        this.callback = cb;
        this.options = options || {};
        this.elements = new Set();
        this.root = null;
        this.rootMargin = '';
        this.thresholds = [0];
      }

      takeRecords(): IntersectionObserverEntry[] {
        return [];
      }

      observe(target: Element) {
        this.elements.add(target);
        // Simulate initial intersection
        this.callback(
          [
            {
              target,
              intersectionRatio: 0,
              isIntersecting: false,
              boundingClientRect: {} as DOMRectReadOnly,
              intersectionRect: {} as DOMRectReadOnly,
              rootBounds: null,
              time: 0,
            },
          ],
          this
        );
      }

      unobserve(target: Element) {
        this.elements.delete(target);
      }

      disconnect() {
        this.elements.clear();
      }
    };

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
    MockApiClient.clearMockResponses();
    // Clean up the DOM elements
    document.body.innerHTML = '';
  });

  it('highlights section with highest intersection ratio', async () => {
    const mockDispatch = jest.fn();
    const useIssueDetailsMock = jest.mocked(useIssueDetails);

    // Initial render with no active section
    useIssueDetailsMock.mockReturnValue({
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
      sectionVisibility: {},
      dispatch: mockDispatch,
    });

    const {rerender} = render(<EventTitle {...defaultProps} />);

    // Wait for initial render
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Highlights'})).toBeInTheDocument();
    });

    // Update mock to show Highlights as most visible and trigger re-render
    useIssueDetailsMock.mockReturnValue({
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
      sectionVisibility: {
        [SectionKey.HIGHLIGHTS]: 0.8,
        [SectionKey.TAGS]: 0.2,
        [SectionKey.REPLAY]: 0.1,
      },
      dispatch: mockDispatch,
    });

    // Force re-render with new context
    rerender(<EventTitle {...defaultProps} />);

    // Verify the highlight is applied
    const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
    expect(highlightsLink).toHaveAttribute('data-active', 'true');

    const tagsLink = screen.getByRole('button', {name: 'Tags'});
    const replayLink = screen.getByRole('button', {name: 'Replay'});
    expect(tagsLink).toHaveAttribute('data-active', 'false');
    expect(replayLink).toHaveAttribute('data-active', 'false');
  });

  it('updates highlight when scrolling to different section', async () => {
    const mockDispatch = jest.fn();
    const useIssueDetailsMock = jest.mocked(useIssueDetails);

    // Initial render with Highlights active
    useIssueDetailsMock.mockReturnValue({
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
      sectionVisibility: {
        [SectionKey.HIGHLIGHTS]: 0.8,
        [SectionKey.TAGS]: 0.2,
        [SectionKey.REPLAY]: 0.1,
      },
      dispatch: mockDispatch,
    });

    const {rerender} = render(<EventTitle {...defaultProps} />);

    // Wait for initial render with Highlights active
    await waitFor(() => {
      const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
      expect(highlightsLink).toHaveAttribute('data-active', 'true');
    });

    // Update mock to show Tags as most visible
    useIssueDetailsMock.mockReturnValue({
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
      sectionVisibility: {
        [SectionKey.HIGHLIGHTS]: 0.1,
        [SectionKey.TAGS]: 0.9,
        [SectionKey.REPLAY]: 0.2,
      },
      dispatch: mockDispatch,
    });

    // Force re-render with new context
    rerender(<EventTitle {...defaultProps} />);

    // Verify the highlight has moved to Tags
    const tagsLink = screen.getByRole('button', {name: 'Tags'});
    expect(tagsLink).toHaveAttribute('data-active', 'true');

    const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
    const replayLink = screen.getByRole('button', {name: 'Replay'});
    expect(highlightsLink).toHaveAttribute('data-active', 'false');
    expect(replayLink).toHaveAttribute('data-active', 'false');
  });

  it('removes highlight when section is not visible', async () => {
    render(<EventTitle {...defaultProps} />);

    // Wait for initial render and effects
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Highlights'})).toBeInTheDocument();
    });

    // Initially Highlights section most visible
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
      sectionVisibility: {
        [SectionKey.HIGHLIGHTS]: 0.8,
        [SectionKey.TAGS]: 0.2,
        [SectionKey.REPLAY]: 0.1,
      },
      dispatch: mockDispatch,
    });

    // Re-render with updated context
    await act(async () => {});

    // Then no sections visible
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
      sectionVisibility: {
        [SectionKey.HIGHLIGHTS]: 0,
        [SectionKey.TAGS]: 0,
        [SectionKey.REPLAY]: 0,
      },
      dispatch: mockDispatch,
    });

    // Re-render with updated context
    await act(async () => {});

    const highlightsLink = screen.getByRole('button', {name: 'Highlights'});
    const tagsLink = screen.getByRole('button', {name: 'Tags'});
    const replayLink = screen.getByRole('button', {name: 'Replay'});

    expect(highlightsLink).toHaveAttribute('data-active', 'false');
    expect(tagsLink).toHaveAttribute('data-active', 'false');
    expect(replayLink).toHaveAttribute('data-active', 'false');
  });

  it('dispatches visibility updates when sections intersect', async () => {
    render(<EventTitle {...defaultProps} />);

    // Wait for initial render and effects
    await waitFor(() => {
      expect(screen.getByRole('button', {name: 'Highlights'})).toBeInTheDocument();
    });

    // Simulate intersection for Highlights section
    const highlightsDiv = document.getElementById(SectionKey.HIGHLIGHTS)!;
    const observer = new IntersectionObserver(() => {});
    observer.observe(highlightsDiv);

    expect(mockDispatch).toHaveBeenCalledWith({
      type: 'UPDATE_SECTION_VISIBILITY',
      sectionId: SectionKey.HIGHLIGHTS,
      ratio: 0,
    });
  });
});
