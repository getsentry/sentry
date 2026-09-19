import {Fragment} from 'react';
import Cookies from 'js-cookie';
import {GroupFixture} from 'sentry-fixture/group';
import {GroupStatsFixture} from 'sentry-fixture/groupStats';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {GroupStore} from 'sentry/stores/groupStore';
import {IssueListCacheStore} from 'sentry/stores/IssueListCacheStore';
import {TagStore} from 'sentry/stores/tagStore';
import {GroupStatus, GroupSubstatus, PriorityLevel} from 'sentry/types/group';
import IssueListOverview from 'sentry/views/issueList/overview';

const DEFAULT_LINKS_HEADER =
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575731:0:1>; rel="previous"; results="false"; cursor="1443575731:0:1", ' +
  '<http://127.0.0.1:8000/api/0/organizations/org-slug/issues/?cursor=1443575000:0:0>; rel="next"; results="true"; cursor="1443575000:0:0"';

describe('IssueListOverview (actions)', () => {
  const groupStats = GroupStatsFixture();
  const organization = OrganizationFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    GroupStore.reset();
    IssueListCacheStore.reset();

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
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

  describe('status', () => {
    const group1 = GroupFixture({
      id: '1',
      metadata: {
        title: 'Group 1',
      },
      shortId: 'JAVASCRIPT-1',
      substatus: GroupSubstatus.ONGOING,
    });
    const group2 = GroupFixture({
      id: '2',
      metadata: {
        title: 'Group 2',
      },
      shortId: 'JAVASCRIPT-2',
      substatus: GroupSubstatus.ONGOING,
    });
    const group3 = GroupFixture({
      id: '3',
      metadata: {
        title: 'Group 3',
      },
      shortId: 'JAVASCRIPT-3',
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    it('removes issues after resolving', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview />, {organization});

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

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

    it('refreshes after resolving all issues on page', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(
        <Fragment>
          <IssueListOverview />
          <GlobalModal />
        </Fragment>,
        {
          organization,

          initialRouterConfig: {
            route: '/organizations/:orgId/issues/',
            location: {
              pathname: '/organizations/org-slug/issues/',
              query: {query: 'is:unresolved'},
            },
          },
        }
      );

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      await userEvent.click(screen.getByRole('checkbox', {name: /select all/i}));

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // After action, will refetch so need to mock that response
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group3],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

      const confirmationModal = await screen.findByRole('dialog');

      expect(
        within(confirmationModal).getByText(
          'Are you sure you want to resolve these 2 issues?'
        )
      ).toBeInTheDocument();
      await userEvent.click(
        within(confirmationModal).getByRole('button', {name: 'Resolve 2 selected issues'})
      );

      await waitFor(() => {
        expect(updateIssueMock).toHaveBeenCalledWith(
          '/organizations/org-slug/issues/',
          expect.objectContaining({
            query: expect.objectContaining({id: ['1', '2']}),
            data: {status: 'resolved', statusDetails: {}, substatus: null},
          })
        );
      });

      // After refetch, should only see group 3
      expect(await screen.findByText('Group 3')).toBeInTheDocument();
      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.queryByText('Group 2')).not.toBeInTheDocument();
      expect(screen.getAllByText('Resolved 2 issues')).toHaveLength(1);
    });

    it('can undo resolve action', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
        body: {status: GroupStatus.RESOLVED, statusDetails: {}, substatus: null},
      });

      render(<IssueListOverview />, {organization});

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

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
          data: {
            status: 'unresolved',
            statusDetails: {},
            substatus: GroupSubstatus.ONGOING,
          },
        })
      );
      expect(await screen.findByText('Group 1')).toBeInTheDocument();
    });

    it('confirms query-wide resolution without offering Undo', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER, 'X-Hits': '20'},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
        body: {status: GroupStatus.RESOLVED},
      });
      render(
        <Fragment>
          <IssueListOverview />
          <GlobalModal />
        </Fragment>,
        {organization}
      );

      await screen.findByText('Group 1');
      await userEvent.click(screen.getByRole('checkbox', {name: /select all/i}));
      await userEvent.click(
        screen.getByText(/Select all 20 issues that match this search query/)
      );
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
      await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));
      const dialog = await screen.findByRole('dialog');
      await userEvent.click(
        within(dialog).getByRole('button', {name: 'Bulk resolve issues'})
      );

      expect(await screen.findByText('Selected issues resolved')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Undo'})).not.toBeInTheDocument();
      await waitFor(() => expect(screen.queryByText('Group 1')).not.toBeInTheDocument());
    });

    it('does not offer Undo when resolving a previously archived issue', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [
          GroupFixture({
            id: '1',
            shortId: 'JAVASCRIPT-1',
            metadata: {title: 'Group 1'},
            status: GroupStatus.IGNORED,
            substatus: GroupSubstatus.ARCHIVED_FOREVER,
          }),
          group2,
        ],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
        body: {status: GroupStatus.RESOLVED},
      });
      render(<IssueListOverview initialQuery="" />, {organization});

      await screen.findByText('Group 1');
      await userEvent.click(
        within(screen.getAllByTestId('group')[0]!).getByRole('checkbox', {
          name: /select issue/i,
        })
      );
      await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

      expect(await screen.findByText('Resolved JAVASCRIPT-1')).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Undo'})).not.toBeInTheDocument();
    });

    it('shows an error without success when resolution fails', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
        statusCode: 500,
      });
      render(<IssueListOverview />, {organization});

      await screen.findByText('Group 1');
      await userEvent.click(
        within(screen.getAllByTestId('group')[0]!).getByRole('checkbox', {
          name: /select issue/i,
        })
      );
      await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));
      expect(await screen.findByText('Unable to resolve issues')).toBeInTheDocument();
      expect(screen.queryByText('Resolving issues…')).not.toBeInTheDocument();
      expect(screen.queryByText('Resolved JAVASCRIPT-1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 1')).toBeInTheDocument();
    });
  });

  describe('mark reviewed', () => {
    const group1 = GroupFixture({
      id: '1',
      metadata: {
        title: 'Group 1',
      },
      shortId: 'JAVASCRIPT-1',
      inbox: {},
    });
    const group2 = GroupFixture({
      id: '2',
      metadata: {
        title: 'Group 2',
      },
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

    it('removes issues after making reviewed (when on for review tab)', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview />, {
        organization,

        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {query: 'is:for_review'},
          },
        },
      });

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

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

  describe('priority', () => {
    const medPriorityGroup = GroupFixture({
      id: '1',
      priority: PriorityLevel.MEDIUM,
      metadata: {
        title: 'Medium priority issue',
      },
    });
    const highPriorityGroup = GroupFixture({
      id: '2',
      priority: PriorityLevel.HIGH,
      metadata: {
        title: 'High priority issue',
      },
    });

    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [medPriorityGroup, highPriorityGroup],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    it('removes issues after bulk reprioritizing (when excluding priorities)', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview />, {
        organization,
      });

      expect(await screen.findByText('Medium priority issue')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

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

    it('removes issues after reprioritizing single issue (when excluding priorities)', async () => {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/prompts-activity/',
        body: {data: {dismissed_ts: null}},
      });
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview />, {
        organization,

        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {query: 'is:unresolved issue.priority:[medium,high]'},
          },
        },
      });

      expect(await screen.findByText('Medium priority issue')).toBeInTheDocument();

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

    it('does not remove issues after bulk reprioritizing (when query includes all priorities)', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });

      render(<IssueListOverview />, {
        organization,

        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {query: 'is:unresolved issue.priority:[medium,high]'},
          },
        },
      });

      expect(await screen.findByText('Medium priority issue')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

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

  describe('realtime mode', () => {
    const group1 = GroupFixture({
      id: '1',
      metadata: {title: 'Group 1'},
      shortId: 'JAVASCRIPT-1',
    });
    const group2 = GroupFixture({
      id: '2',
      metadata: {title: 'Group 2'},
      shortId: 'JAVASCRIPT-2',
    });

    beforeEach(() => {
      jest.spyOn(Cookies, 'get').mockImplementation((name?: string) => {
        if (name === 'realtimeActive') {
          return 'true';
        }
        return {};
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('removes a resolved issue from the stream without triggering a refetch', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });
      // This is the GET for the initial load; we track calls to assert no refetch happens
      const getIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      render(<IssueListOverview />, {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {query: 'is:unresolved'},
          },
        },
      });

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      expect(screen.getByText('Group 1')).toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      const initialGetCallCount = getIssueMock.mock.calls.length;

      await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
          data: {status: 'resolved', statusDetails: {}, substatus: null},
        })
      );

      // Issue should be removed from the stream
      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // No additional GET request should have been triggered by the action
      expect(getIssueMock.mock.calls).toHaveLength(initialGetCallCount);
    });

    it('removes an archived issue from the stream without triggering a refetch', async () => {
      const updateIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        method: 'PUT',
      });
      const getIssueMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/issues/',
        body: [group1, group2],
        headers: {Link: DEFAULT_LINKS_HEADER},
      });

      render(<IssueListOverview />, {
        organization,
        initialRouterConfig: {
          route: '/organizations/:orgId/issues/',
          location: {
            pathname: '/organizations/org-slug/issues/',
            query: {query: 'is:unresolved'},
          },
        },
      });

      expect(await screen.findByText('Group 1')).toBeInTheDocument();
      const groups = screen.getAllByTestId('group');

      await userEvent.click(
        within(groups[0]!).getByRole('checkbox', {name: /select issue/i})
      );

      const initialGetCallCount = getIssueMock.mock.calls.length;

      await userEvent.click(await screen.findByRole('button', {name: 'Archive'}));

      expect(updateIssueMock).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/',
        expect.objectContaining({
          query: expect.objectContaining({id: ['1']}),
        })
      );

      expect(screen.queryByText('Group 1')).not.toBeInTheDocument();
      expect(screen.getByText('Group 2')).toBeInTheDocument();

      // No additional GET request should have been triggered by the action
      expect(getIssueMock.mock.calls).toHaveLength(initialGetCallCount);
    });
  });
});
