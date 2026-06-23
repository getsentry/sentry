import {Fragment} from 'react';
import {EventStacktraceExceptionFixture} from 'sentry-fixture/eventStacktraceException';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TeamFixture} from 'sentry-fixture/team';
import {UserFixture} from 'sentry-fixture/user';

import {
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {GlobalModal} from '@sentry/scraps/modal';

import {
  CMDKCollection,
  CommandPaletteProvider,
  type CMDKActionData,
} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {mockTour} from 'sentry/components/tours/testUtils';
import {ConfigStore} from 'sentry/stores/configStore';
import {ModalStore} from 'sentry/stores/modalStore';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupStatus, IssueCategory, PriorityLevel, type Group} from 'sentry/types/group';
import * as analytics from 'sentry/utils/analytics';
import {getMessage, getTitle} from 'sentry/utils/events';
import {GroupActions} from 'sentry/views/issueDetails/actions';
import {useGroup} from 'sentry/views/issueDetails/useGroup';

const project = ProjectFixture({
  id: '2448',
  name: 'project name',
  slug: 'project',
  teams: [TeamFixture({id: '3', slug: 'frontend', name: 'Frontend'})],
});

const group = GroupFixture({
  id: '1337',
  pluginActions: [],
  pluginIssues: [],
  issueCategory: IssueCategory.ERROR,
  project,
});

const issuePlatformGroup = GroupFixture({
  id: '1338',
  issueCategory: IssueCategory.FEEDBACK,
  project,
});

const organization = OrganizationFixture({
  id: '4660',
  slug: 'org',
});

jest.mock('sentry/views/issueDetails/issueDetailsTour', () => ({
  ...jest.requireActual('sentry/views/issueDetails/issueDetailsTour'),
  useIssueDetailsTour: () => mockTour(),
}));

function CommandPaletteTree({
  onTree,
}: {
  onTree: (tree: Array<CollectionTreeNode<CMDKActionData>>) => void;
}) {
  const store = CMDKCollection.useStore();
  onTree(store.tree());
  return null;
}

function SlotOutlets() {
  return (
    <div style={{display: 'none'}}>
      <CommandPaletteSlot.Outlet name="task">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="page">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
      <CommandPaletteSlot.Outlet name="global">
        {p => <div {...p} />}
      </CommandPaletteSlot.Outlet>
    </div>
  );
}

describe('GroupActions', () => {
  const analyticsSpy = jest.spyOn(analytics, 'trackAnalytics');

  beforeEach(() => {
    ConfigStore.init();
    ProjectsStore.reset();
    ProjectsStore.loadInitialData([project]);
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events//committers/`,
      body: {committers: []},
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events//owners/`,
      body: {owners: [], rules: []},
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/autofix/setup/`,
      body: {
        billing: null,
        integration: {ok: false, reason: null},
        seerReposLinked: false,
        githubWriteIntegration: null,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/integrations/coding-agents/`,
      body: {integrations: []},
    });
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  describe('render()', () => {
    it('renders correctly', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );
      expect(await screen.findByRole('button', {name: 'Resolve'})).toBeInTheDocument();
    });
  });

  describe('subscribing', () => {
    let issuesApi: any;
    beforeEach(() => {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isSubscribed: false}),
      });
    });

    it('can subscribe', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );
      await userEvent.click(screen.getByRole('button', {name: 'Subscribe'}));

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isSubscribed: true},
        })
      );
    });
  });

  describe('bookmarking', () => {
    let issuesApi: any;

    beforeEach(() => {
      issuesApi = MockApiClient.addMockResponse({
        url: '/projects/org/project/issues/',
        method: 'PUT',
        body: GroupFixture({isBookmarked: false}),
      });
    });

    it('can bookmark', async () => {
      render(
        <GroupActions group={group} project={project} disabled={false} event={null} />,
        {
          organization,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));

      const bookmark = await screen.findByTestId('bookmark');
      await userEvent.click(bookmark);

      expect(issuesApi).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {isBookmarked: true},
        })
      );
    });
  });

  describe('reprocessing', () => {
    it('renders ReprocessAction component if org has native exception event', async () => {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions group={group} project={project} event={event} disabled={false} />,
        {
          organization,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
    });

    it('open dialog by clicking on the ReprocessAction component', async () => {
      const event = EventStacktraceExceptionFixture({
        platform: 'native',
      });

      render(
        <GroupActions group={group} project={project} event={event} disabled={false} />,
        {
          organization,
        }
      );

      const onReprocessEventFunc = jest.spyOn(ModalStore, 'openModal');

      await userEvent.click(screen.getByLabelText('More Actions'));

      const reprocessActionButton = await screen.findByTestId('reprocess');
      expect(reprocessActionButton).toBeInTheDocument();
      await userEvent.click(reprocessActionButton);
      await waitFor(() => expect(onReprocessEventFunc).toHaveBeenCalled());
    });
  });

  describe('delete', () => {
    it('opens delete confirm modal from more actions dropdown', async () => {
      const org = OrganizationFixture({
        ...organization,
        access: [...organization.access, 'event:admin'],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'PUT',
        body: {},
      });
      const deleteMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'DELETE',
        body: {},
      });
      const initialRouterConfig = {
        location: {
          pathname: `/organizations/${org.slug}/issues/${group.id}/`,
        },
        route: '/organizations/:orgId/issues/:groupId/',
      };
      const {router} = render(
        <Fragment>
          <GlobalModal />
          <GroupActions group={group} project={project} disabled={false} event={null} />
        </Fragment>,
        {
          organization: org,
          initialRouterConfig,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      const modal = screen.getByRole('dialog');
      expect(
        within(modal).getByText(/Deleting this issue is permanent/)
      ).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

      expect(deleteMock).toHaveBeenCalled();
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/`,
          query: {project: project.id},
        })
      );
    });

    it('delete for issue platform', async () => {
      const org = OrganizationFixture({
        ...organization,
        access: [...organization.access, 'event:admin'],
      });
      MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'PUT',
        body: {},
      });
      const deleteMock = MockApiClient.addMockResponse({
        url: `/projects/${org.slug}/${project.slug}/issues/`,
        method: 'DELETE',
        body: {},
      });
      const initialRouterConfig = {
        location: {
          pathname: `/organizations/${org.slug}/issues/${issuePlatformGroup.id}/`,
        },
        route: '/organizations/:orgId/issues/:groupId/',
      };
      const {router} = render(
        <Fragment>
          <GlobalModal />
          <GroupActions
            group={issuePlatformGroup}
            project={project}
            disabled={false}
            event={null}
          />
        </Fragment>,
        {
          organization: org,
          initialRouterConfig,
        }
      );

      await userEvent.click(screen.getByLabelText('More Actions'));
      await userEvent.click(await screen.findByRole('menuitemradio', {name: 'Delete'}));

      const modal = screen.getByRole('dialog');
      expect(
        within(modal).getByText(/Deleting this issue is permanent/)
      ).toBeInTheDocument();

      await userEvent.click(within(modal).getByRole('button', {name: 'Delete'}));

      expect(deleteMock).toHaveBeenCalled();
      expect(router.location).toEqual(
        expect.objectContaining({
          pathname: `/organizations/${org.slug}/issues/`,
          query: {project: project.id},
        })
      );
    });
  });

  it('resolves and unresolves issue', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    const {rerender} = render(
      <GroupActions group={group} project={project} disabled={false} event={null} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: 'Resolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );
    expect(analyticsSpy).toHaveBeenCalledWith(
      'issue_details.action_clicked',
      expect.objectContaining({
        action_type: 'resolved',
      })
    );

    rerender(
      <GroupActions
        group={{...group, status: GroupStatus.RESOLVED, statusDetails: {}}}
        project={project}
        disabled={false}
        event={null}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Unresolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'unresolved', statusDetails: {}, substatus: 'ongoing'},
      })
    );
  });

  it('can archive issue', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    render(
      <GroupActions group={group} project={project} disabled={false} event={null} />,
      {
        organization,
      }
    );

    await userEvent.click(await screen.findByRole('button', {name: 'Archive'}));

    expect(issuesApi).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        data: {
          status: 'ignored',
          statusDetails: {},
          substatus: 'archived_until_escalating',
        },
      })
    );
    expect(analyticsSpy).toHaveBeenCalledWith(
      'issue_details.action_clicked',
      expect.objectContaining({
        action_substatus: 'archived_until_escalating',
        action_type: 'ignored',
      })
    );
  });

  it('refetches group data after resolve action using useGroup hook', async () => {
    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/project/issues/`,
      method: 'PUT',
      body: {...group, status: 'resolved'},
    });

    // Mock the group fetch API that useGroup hook will call
    const groupFetchApi = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/`,
      method: 'GET',
      body: group,
    });

    function GroupActionsWrapper() {
      const {data: groupData, isLoading} = useGroup({groupId: group.id});

      if (isLoading || !groupData) {
        return <div>Loading...</div>;
      }

      return (
        <GroupActions group={groupData} project={project} disabled={false} event={null} />
      );
    }

    render(<GroupActionsWrapper />, {organization});

    await waitFor(() => {
      expect(groupFetchApi).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Resolve'}));

    expect(issuesApi).toHaveBeenCalledWith(
      `/projects/${organization.slug}/project/issues/`,
      expect.objectContaining({
        data: {status: 'resolved', statusDetails: {}, substatus: null},
      })
    );

    // Verify that the group is fetched a second time after the action to refresh data
    await waitFor(() => {
      expect(groupFetchApi).toHaveBeenCalledTimes(2);
    });
  });

  describe('command palette labels', () => {
    beforeEach(() => {
      ConfigStore.loadInitialData({
        user: UserFixture({id: '1', name: 'Test User'}),
      } as any);
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/users/`,
        method: 'GET',
        body: [
          UserFixture({id: '1', name: 'Test User'}),
          UserFixture({id: '2', name: 'Grace Hopper'}),
          UserFixture({id: '7', name: 'Ada Lovelace'}),
        ].map(user => ({user})),
      });
    });

    function renderWithCommandPalette(commandGroup: Group) {
      const treeRef: {
        current: Array<CollectionTreeNode<CMDKActionData>>;
      } = {current: []};
      render(
        <CommandPaletteProvider>
          <GroupActions
            group={commandGroup}
            project={project}
            disabled={false}
            event={null}
          />
          <SlotOutlets />
          <CommandPaletteTree
            onTree={tree => {
              treeRef.current = tree;
            }}
          />
        </CommandPaletteProvider>,
        {organization}
      );

      return treeRef;
    }

    it('omits stale default state text from task actions', async () => {
      const treeRef = renderWithCommandPalette(group);

      await waitFor(() => {
        expect(treeRef.current.length).toBeGreaterThan(0);
      });

      const labels = treeRef.current.flatMap(node => [
        node.display.label,
        ...node.children.map(child => child.display.label),
      ]);
      const issueTaskGroup = treeRef.current[0];

      expect(labels).toContain('Archive');
      expect(labels).toContain('Resolve');
      expect(labels).toContain('Set Priority');
      expect(labels).toContain('Assign to');
      const issueTitle = getTitle(group).title;
      const issueMessage = getMessage(group);
      expect(issueTaskGroup?.display.label).toBe(
        issueMessage && issueMessage !== issueTitle
          ? `${issueTitle}: ${issueMessage}`
          : issueTitle
      );
      expect(issueTaskGroup?.display.details).toBeUndefined();

      expect(labels).not.toContain('Resolve (Unresolved)');
      expect(labels).not.toContain('Archive (Active)');
      expect(labels).not.toContain('Assign (Unassigned)');
    });

    it('shows current priority icon and assignee when present', async () => {
      const treeRef = renderWithCommandPalette(
        GroupFixture({
          ...group,
          priority: PriorityLevel.HIGH,
          assignedTo: {
            id: '7',
            type: 'user',
            name: 'Ada Lovelace',
            email: 'ada@example.com',
          },
        })
      );

      await waitFor(() => {
        expect(treeRef.current.length).toBeGreaterThan(0);
      });

      const issueTaskGroup = treeRef.current[0];
      const labels = issueTaskGroup?.children.map(child => child.display.label) ?? [];
      const setPriorityAction = issueTaskGroup?.children.find(
        child => child.display.label === 'Set Priority'
      );
      const assignAction = issueTaskGroup?.children.find(
        child => child.display.label === 'Assign to'
      );
      const assignLabels = assignAction?.children.map(child => child.display.label) ?? [];
      const assignToMeIndex = assignLabels.indexOf('Assign to me');
      const unassignIndex = assignLabels.indexOf('Unassign from Ada Lovelace');
      const unassignAction = assignAction?.children.find(
        child => child.display.label === 'Unassign from Ada Lovelace'
      );

      expect(labels).toContain('Set Priority');
      expect(labels).toContain('Assign to');
      expect(assignLabels).toContain('Assign to me');
      expect(assignLabels).toContain('Unassign from Ada Lovelace');
      expect(assignLabels).toContain('#frontend');
      expect(unassignIndex).toBe(assignToMeIndex + 1);
      expect(unassignAction?.display.icon).toMatchObject({
        props: {actor: expect.objectContaining({name: 'Ada Lovelace'})},
      });
      expect(setPriorityAction?.display.icon).toMatchObject({props: {bars: 3}});
      expect(assignAction?.display.icon).toMatchObject({
        props: {actor: expect.objectContaining({name: 'Ada Lovelace'})},
      });
    });
  });
});
