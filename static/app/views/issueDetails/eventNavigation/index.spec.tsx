import {useMatches} from 'react-router-dom';
import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import {AutofixPanelProvider} from 'sentry/views/issueDetails/autofix/context';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/context';
import {GroupDataContextProvider} from 'sentry/views/issueDetails/groupDataContext';
import {Tab, TabPaths} from 'sentry/views/issueDetails/types';

import {IssueEventNavigation} from '.';

jest.mock('sentry/views/issueDetails/context');
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useMatches: jest.fn(),
}));

const mockUseMatches = jest.mocked(useMatches);

describe('EventNavigation', () => {
  const organization = OrganizationFixture({features: ['discover-basic']});
  const group = GroupFixture({id: 'group-id'});
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
  const defaultProps: React.ComponentProps<typeof IssueEventNavigation> = {
    event: testEvent,
    group,
  };

  const initialRouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
    },
    route: '/organizations/:orgId/issues/:groupId/events/',
  };

  beforeEach(() => {
    jest.resetAllMocks();
    mockUseMatches.mockImplementation(() => [
      {id: '0', pathname: '/', params: {}, data: null, handle: {path: '/'}},
      {
        id: '0-0',
        pathname: '/organizations/org-slug/issues/group-id/',
        params: {orgId: 'org-slug', groupId: 'group-id'},
        data: null,
        handle: {path: '/organizations/:orgId/issues/:groupId/'},
      },
      {
        id: '0-0-0',
        pathname: '/organizations/org-slug/issues/group-id/events/',
        params: {orgId: 'org-slug', groupId: 'group-id'},
        data: null,
        handle: {path: TabPaths[Tab.EVENTS]},
      },
    ]);
    jest.mocked(useIssueDetails).mockReturnValue({
      sectionData: {
        highlights: {key: SectionKey.HIGHLIGHTS},
        tags: {key: SectionKey.TAGS},
        replay: {key: SectionKey.REPLAY},
      },
      detectorDetails: {},
      eventCount: 0,
      eventNavigationHeight: 0,
      isSidebarOpen: true,
      navScrollMargin: 0,
      dispatch: jest.fn(),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/replay-count/',
      body: {},
    });
  });

  describe('all events buttons', () => {
    it('renders the all events controls', () => {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>,
        {
          initialRouterConfig,
          organization,
        }
      );

      const discoverButton = screen.getByLabelText('Open in Discover');
      expect(discoverButton).toBeInTheDocument();
      expect(discoverButton).toHaveAttribute(
        'href',
        expect.stringContaining(
          `/organizations/${organization.slug}/explore/discover/results/`
        )
      );

      const closeButton = screen.getByRole('button', {name: 'Return to event details'});
      expect(closeButton).toBeInTheDocument();
      expect(closeButton).toHaveAttribute(
        'href',
        expect.stringContaining(`/organizations/${organization.slug}/issues/${group.id}/`)
      );
    });

    it('supplies the default timestamp sort when no sort is set in the query params', () => {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>,
        {
          initialRouterConfig,
          organization,
        }
      );

      const discoverButton = screen.getByLabelText('Open in Discover');
      expect(discoverButton).toBeInTheDocument();
      const url = new URL(
        discoverButton.getAttribute('href') ?? '',
        'https://www.example.com'
      );
      expect(url.searchParams.get('sort')).toBe('-timestamp');
    });

    it('supplies the sort when it is set in the query params', () => {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>,
        {
          initialRouterConfig: {
            ...initialRouterConfig,
            location: {
              ...initialRouterConfig.location,
              query: {sort: '-title'},
            },
          },
          organization,
        }
      );

      const discoverButton = screen.getByLabelText('Open in Discover');
      expect(discoverButton).toBeInTheDocument();
      const url = new URL(
        discoverButton.getAttribute('href') ?? '',
        'https://www.example.com'
      );
      expect(url.searchParams.get('sort')).toBe('-title');
    });
  });

  describe('issue content navigation', () => {
    const seerOrganization = OrganizationFixture({
      features: ['discover-basic', 'gen-ai-features', 'autofix-page'],
      hideAiFeatures: false,
    });

    function renderNav(org: typeof organization) {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>,
        {initialRouterConfig, organization: org}
      );
    }

    it('renders a tab list with the autofix-page feature', () => {
      renderNav(seerOrganization);

      // Tabs replace the dropdown entirely, so the trigger is gone.
      expect(
        screen.queryByRole('button', {name: 'Select issue content'})
      ).not.toBeInTheDocument();

      // Autofix sits second, right after the events tab.
      expect(screen.getAllByRole('tab')[1]).toHaveAccessibleName('Autofix');

      // Counts ride along inside the tab label; Autofix is a single ongoing
      // analysis, so it has none.
      const eventsTab = screen.getAllByRole('tab')[0]!;
      expect(within(eventsTab).getByText('0')).toBeInTheDocument();
      expect(
        within(screen.getByRole('tab', {name: 'Autofix'})).queryByText('0')
      ).not.toBeInTheDocument();

      // The tab is the <li role="tab">; the anchor it navigates through is nested.
      const autofixTab = screen.getByRole('tab', {name: 'Autofix'});
      expect(within(autofixTab).getByRole('link')).toHaveAttribute(
        'href',
        expect.stringContaining(
          `/organizations/${seerOrganization.slug}/issues/${group.id}/${
            TabPaths[Tab.AUTOFIX]
          }`
        )
      );
    });

    it('lifts the seer toolbar into the navigation row on the autofix tab', async () => {
      mockUseMatches.mockImplementation(() => [
        {id: '0', pathname: '/', params: {}, data: null, handle: {path: '/'}},
        {
          id: '0-0',
          pathname: '/organizations/org-slug/issues/group-id/autofix/',
          params: {orgId: 'org-slug', groupId: 'group-id'},
          data: null,
          handle: {path: TabPaths[Tab.AUTOFIX]},
        },
      ]);
      MockApiClient.addMockResponse({
        url: `/organizations/${seerOrganization.slug}/issues/${group.id}/autofix/`,
        body: {autofix: null},
      });
      MockApiClient.addMockResponse({
        url: `/organizations/${seerOrganization.slug}/issues/${group.id}/autofix/setup/`,
        body: {integration: {ok: true, reason: null}},
      });

      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <AutofixPanelProvider group={group} project={group.project}>
            <IssueEventNavigation {...defaultProps} />
          </AutofixPanelProvider>
        </GroupDataContextProvider>,
        {initialRouterConfig, organization: seerOrganization}
      );

      expect(
        await screen.findByRole('button', {name: 'Start a new analysis from scratch'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Copy analysis as Markdown'})
      ).toBeInTheDocument();
    });

    it('falls back to the dropdown without the autofix-page feature', () => {
      renderNav(organization);

      expect(screen.queryByRole('tab')).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Select issue content'})
      ).toBeInTheDocument();
    });

    it('omits the autofix tab when AI features are hidden', () => {
      renderNav(
        OrganizationFixture({
          features: ['discover-basic', 'gen-ai-features', 'autofix-page'],
          hideAiFeatures: true,
        })
      );

      expect(screen.queryByRole('tab', {name: 'Autofix'})).not.toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Select issue content'})
      ).toBeInTheDocument();
    });
  });

  describe('counts', () => {
    it('renders default counts', async () => {
      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>
      );
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 0'})
      ).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Events 0'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Replays 0'})).toBeInTheDocument();
      expect(screen.getByRole('menuitemradio', {name: 'Feedback 0'})).toBeInTheDocument();
    });

    it('renders 1 attachment', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [EventAttachmentFixture()],
      });

      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>
      );
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 1'})
      ).toBeInTheDocument();
    });

    it('renders 50+ attachments', async () => {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
        body: [EventAttachmentFixture()],
        headers: {
          // Assumes there is more than 50 attachments if there is a next page
          Link: '<https://sentry.io>; rel="previous"; results="false"; cursor="0:0:1", <https://sentry.io>; rel="next"; results="true"; cursor="0:20:0"',
        },
      });

      render(
        <GroupDataContextProvider group={group} project={group.project}>
          <IssueEventNavigation {...defaultProps} />
        </GroupDataContextProvider>
      );
      await userEvent.click(screen.getByRole('button', {name: 'Select issue content'}));

      expect(
        await screen.findByRole('menuitemradio', {name: 'Attachments 50+'})
      ).toBeInTheDocument();
    });
  });
});
