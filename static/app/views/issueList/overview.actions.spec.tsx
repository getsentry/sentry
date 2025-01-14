import {Fragment} from 'react';
import {GlobalSelectionFixture} from 'sentry-fixture/globalSelection';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {RouteComponentPropsFixture} from 'sentry-fixture/routeComponentPropsFixture';
import {TagsFixture} from 'sentry-fixture/tags';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import Indicators from 'sentry/components/indicators';
import GroupStore from 'sentry/stores/groupStore';
import IssueListCacheStore from 'sentry/stores/IssueListCacheStore';
import SelectedGroupStore from 'sentry/stores/selectedGroupStore';
import TagStore from 'sentry/stores/tagStore';
import {PriorityLevel} from 'sentry/types/group';
import IssueListOverview from 'sentry/views/issueList/overview';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

describe('IssueListOverview (actions)', function () {
  const project = ProjectFixture({
    id: '3559',
    name: 'Foo Project',
    slug: 'project-slug',
    firstEvent: new Date().toISOString(),
  });
  const tags = TagsFixture();
  const groupStats = GroupStatsFixture();
  const api = new MockApiClient();
  const organization = OrganizationFixture();

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
    SelectedGroupStore.reset();
    IssueListCacheStore.reset();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-stats/',
      body: [groupStats],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'POST',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      method: 'GET',
      body: [{}],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/processingissues/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/tags/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/sent-first-event/',
      body: {sentFirstEvent: true},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/projects/',
      body: [],
    });

    TagStore.init?.();
  });

  const defaultProps = {
    api,
    savedSearchLoading: false,
    savedSearches: [],
    useOrgSavedSearches: true,
    selection: GlobalSelectionFixture(),
    organization,
    tags: [
      tags.reduce((acc, tag) => {
        // @ts-ignore TS(7053): Element implicitly has an any type because
        acc[tag.key] = tag;

        return acc;
      }),
    ],
    savedSearch: null,
    selectedSearchId: null,
    ...RouteComponentPropsFixture<
      {orgId: string; projectId: string},
      {searchId?: string}
    >({
      location: LocationFixture({
        query: {query: 'is:unresolved issue.priority:[high,medium]'},
      }),
      params: {orgId: organization.slug, projectId: project.slug, searchId: undefined},
    }),
  };

  describe('status', function () {
    const group1 = GroupFixture({
      id: '1',
      culprit: 'Group 1',
      shortId: 'JAVASCRIPT-1',
    });
    const group2 = GroupFixture({
      id: '2',
      culprit: 'Group 2',
      shortId: 'JAVASCRIPT-2',
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    it('removes issues after resolving', async function () {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview {...defaultProps} />, {organization});

      const groups = await screen.findAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {status: 'resolved', statusDetails: {}, substatus: null},
        })
      );

      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
    });

    it('can undo resolve action', async function () {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(
        <Fragment>
          <IssueListOverview {...defaultProps} />
          <Indicators />
        </Fragment>,
        {organization}
      );

      const groups = await screen.findAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {status: 'resolved', statusDetails: {}, substatus: null},
        })
      );

      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // Should show a toast message
      expect(screen.getByText('Resolved JAVASCRIPT-1')).toBeInTheDocument();

      // Clicking the undo button makes a call to set the status back to unresolved
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
      await userEvent.click(screen.getByRole('button', {name: 'Undo'}));
      expect(updateIssueMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {status: 'unresolved', statusDetails: {}},
        })
      );
      expect(await screen.findByText('Group 1')).toBeInTheDocument();
    });
  });

  describe('mark reviewed', function () {
    const group1 = GroupFixture({
      id: '1',
      culprit: 'Group 1',
      shortId: 'JAVASCRIPT-1',
      inbox: {},
    });
    const group2 = GroupFixture({
      id: '2',
      culprit: 'Group 2',
      shortId: 'JAVASCRIPT-2',
      inbox: {},
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    it('removes issues after making reviewed (when on for review tab)', async function () {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(
        <IssueListOverview
          {...defaultProps}
          {...RouteComponentPropsFixture({
            location: LocationFixture({
              query: {query: 'is:for_review'},
            }),
            params: {
              orgId: organization.slug,
              projectId: project.slug,
              searchId: undefined,
            },
          })}
        />,
        {organization}
      );

      const groups = await screen.findAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(
        await screen.findByRole('button', {name: 'More issue actions'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Mark Reviewed'}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {inbox: false},
        })
      );

      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();
    });
  });

  describe('priority', function () {
    const medPriorityGroup = GroupFixture({
      id: '1',
      priority: PriorityLevel.MEDIUM,
      culprit: 'Medium priority issue',
    });
    const highPriorityGroup = GroupFixture({
      id: '2',
      priority: PriorityLevel.HIGH,
      culprit: 'High priority issue',
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [medPriorityGroup, highPriorityGroup],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    it('removes issues after bulk reprioritizing (when excluding priorities)', async function () {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview {...defaultProps} />, {organization});

      const groups = await screen.findAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Medium priority issue')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [highPriorityGroup],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(await screen.findByRole('button', {name: /set priority/i}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: /low/i}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {priority: PriorityLevel.LOW},
        })
      );

      expect(screen.queryByText('Medium priority issue')).not.toBeInTheDocument();
    });

    it('removes issues after reprioritizing single issue (when excluding priorities)', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {data: {dismissed_ts: null}},
      });
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview {...defaultProps} />, {organization});

      expect(screen.getByText('Medium priority issue')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [highPriorityGroup],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(screen.getByText('Med'));
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Low'}));

      await waitFor(() => {
        expect(updateIssueMock).toHaveBeenCalledWith(
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            query: expect.objectContaining({id: ['1']}),
            data: {priority: PriorityLevel.LOW},
          })
        );
      });

      expect(screen.queryByText('Medium priority issue')).not.toBeInTheDocument();
    });

    it('does not remove issues after bulk reprioritizing (when query includes all priorities)', async function () {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(
        <IssueListOverview
          {...defaultProps}
          {...RouteComponentPropsFixture({
            location: LocationFixture({
              query: {query: 'is:unresolved'},
            }),
            params: {
              orgId: organization.slug,
              projectId: project.slug,
              searchId: undefined,
            },
          })}
        />,
        {organization}
      );

      const groups = await screen.findAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Medium priority issue')).toBeInTheDocument();

      await userEvent.click(await screen.findByRole('button', {name: /set priority/i}));
      await userEvent.click(screen.getByRole('menuitemradio', {name: /low/i}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {priority: PriorityLevel.LOW},
        })
      );

      expect(screen.getByText('Medium priority issue')).toBeInTheDocument();
    });
  });
});
