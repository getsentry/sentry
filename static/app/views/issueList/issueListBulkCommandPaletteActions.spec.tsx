import {useLayoutEffect} from 'react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {addLoadingMessage} from 'sentry/actionCreators/indicator';
import {
  CMDKCollection,
  CommandPaletteProvider,
  type CMDKActionData,
} from 'sentry/components/commandPalette/ui/cmdk';
import type {CollectionTreeNode} from 'sentry/components/commandPalette/ui/collection';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {ConfigStore} from 'sentry/stores/configStore';
import {GroupStore} from 'sentry/stores/groupStore';
import {GroupStatus} from 'sentry/types/group';
import {IssueListBulkCommandPaletteActions} from 'sentry/views/issueList/issueListBulkCommandPaletteActions';
import {IssueListCommandPaletteActions} from 'sentry/views/issueList/issueListCommandPaletteActions';
import {
  IssueSelectionProvider,
  useIssueSelectionActions,
} from 'sentry/views/issueList/issueSelectionContext';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

jest.mock('sentry/actionCreators/indicator');

const organization = OrganizationFixture();

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

function SelectionInitializer() {
  const {setAllInQuerySelected, toggleSelectAllVisible} = useIssueSelectionActions();

  useLayoutEffect(() => {
    toggleSelectAllVisible();
    setAllInQuerySelected(true);
  }, [setAllInQuerySelected, toggleSelectAllVisible]);

  return null;
}

describe('IssueListBulkCommandPaletteActions', () => {
  beforeEach(() => {
    GroupStore.reset();
    (addLoadingMessage as jest.Mock).mockClear();
    ConfigStore.loadInitialData({
      user: UserFixture({id: '1', name: 'Test User'}),
    } as any);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/tags/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('shows mark all actions when no issues are selected', async () => {
    const treeRef: {current: Array<CollectionTreeNode<CMDKActionData>>} = {current: []};

    render(
      <CommandPaletteProvider>
        <IssueSelectionProvider visibleGroupIds={['1', '2']}>
          <IssueListCommandPaletteActions
            groupIds={['1', '2']}
            onActionTaken={jest.fn()}
            onQueryChange={jest.fn()}
            onSortChange={jest.fn()}
            query=""
            queryCount={10}
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            sort={IssueSortOptions.DATE}
          />
        </IssueSelectionProvider>
        <SlotOutlets />
        <CommandPaletteTree
          onTree={tree => {
            treeRef.current = tree;
          }}
        />
      </CommandPaletteProvider>,
      {organization}
    );

    await waitFor(() => {
      expect(treeRef.current.length).toBeGreaterThan(0);
    });

    const issueFeedNode = treeRef.current.find(
      node => node.display.label === 'Issues Feed'
    );
    expect(issueFeedNode).toBeDefined();

    const issueFeedLabels = issueFeedNode!.children.map(child => child.display.label);
    expect(issueFeedLabels).toContain('Filter by');
    expect(issueFeedLabels).toContain('Mark all issues as');

    const markAllNode = issueFeedNode!.children.find(
      child => child.display.label === 'Mark all issues as'
    );
    expect(markAllNode).toBeDefined();
    expect(markAllNode!.children.map(child => child.display.label)).toEqual(
      expect.arrayContaining(['Assigned to', 'Resolved', 'Archived'])
    );
  });

  it('shows resolve and archive actions when all matching issues are selected', async () => {
    GroupStore.add([
      GroupFixture({id: '1', status: GroupStatus.RESOLVED}),
      GroupFixture({id: '2', status: GroupStatus.IGNORED}),
    ]);

    const treeRef: {current: Array<CollectionTreeNode<CMDKActionData>>} = {current: []};

    render(
      <CommandPaletteProvider>
        <IssueSelectionProvider visibleGroupIds={['1', '2']}>
          <SelectionInitializer />
          <IssueListBulkCommandPaletteActions
            groupIds={['1', '2']}
            onActionTaken={jest.fn()}
            query=""
            queryCount={10}
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
          />
        </IssueSelectionProvider>
        <SlotOutlets />
        <CommandPaletteTree
          onTree={tree => {
            treeRef.current = tree;
          }}
        />
      </CommandPaletteProvider>,
      {organization}
    );

    await waitFor(() => {
      expect(treeRef.current.length).toBeGreaterThan(0);
    });

    const labels = treeRef.current.flatMap(node => [
      node.display.label,
      ...node.children.map(child => child.display.label),
    ]);

    expect(labels).toContain('Resolve');
    expect(labels).toContain('Archive');
  });

  it('shows a loader when marking all issues as resolved', async () => {
    const treeRef: {current: Array<CollectionTreeNode<CMDKActionData>>} = {current: []};

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
      body: [],
    });

    render(
      <CommandPaletteProvider>
        <IssueSelectionProvider visibleGroupIds={['1', '2']}>
          <IssueListCommandPaletteActions
            groupIds={['1', '2']}
            onActionTaken={jest.fn()}
            onQueryChange={jest.fn()}
            onSortChange={jest.fn()}
            query=""
            queryCount={10}
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            sort={IssueSortOptions.DATE}
          />
        </IssueSelectionProvider>
        <SlotOutlets />
        <CommandPaletteTree
          onTree={tree => {
            treeRef.current = tree;
          }}
        />
      </CommandPaletteProvider>,
      {organization}
    );
    renderGlobalModal();

    await waitFor(() => {
      expect(treeRef.current.length).toBeGreaterThan(0);
    });

    const issueFeedNode = treeRef.current.find(
      node => node.display.label === 'Issues Feed'
    );
    const markAllNode = issueFeedNode?.children.find(
      child => child.display.label === 'Mark all issues as'
    );
    const resolvedAction = markAllNode?.children.find(
      child => child.display.label === 'Resolved' && 'onAction' in child
    );

    expect(resolvedAction).toBeDefined();

    act(() => {
      if (resolvedAction && 'onAction' in resolvedAction) {
        resolvedAction.onAction();
      }
    });

    expect(addLoadingMessage).not.toHaveBeenCalled();
    expect(
      await screen.findByText(
        'You are about to resolve all 10 issues matching this search. Are you sure?'
      )
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));

    expect(addLoadingMessage).toHaveBeenCalledWith('Saving changes…');
  });

  it('sends query-based API request when marking all issues as resolved', async () => {
    const treeRef: {current: Array<CollectionTreeNode<CMDKActionData>>} = {current: []};

    const bulkUpdateMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/`,
      method: 'PUT',
      body: [],
    });

    render(
      <CommandPaletteProvider>
        <IssueSelectionProvider visibleGroupIds={['1', '2']}>
          <IssueListCommandPaletteActions
            groupIds={['1', '2']}
            onActionTaken={jest.fn()}
            onQueryChange={jest.fn()}
            onSortChange={jest.fn()}
            query="is:unresolved"
            queryCount={10}
            selection={{
              projects: [1],
              environments: [],
              datetime: {start: null, end: null, period: null, utc: true},
            }}
            sort={IssueSortOptions.DATE}
          />
        </IssueSelectionProvider>
        <SlotOutlets />
        <CommandPaletteTree
          onTree={tree => {
            treeRef.current = tree;
          }}
        />
      </CommandPaletteProvider>,
      {organization}
    );
    renderGlobalModal();

    await waitFor(() => {
      expect(treeRef.current.length).toBeGreaterThan(0);
    });

    const issueFeedNode = treeRef.current.find(
      node => node.display.label === 'Issues Feed'
    );
    const markAllNode = issueFeedNode?.children.find(
      child => child.display.label === 'Mark all issues as'
    );
    const resolvedAction = markAllNode?.children.find(
      child => child.display.label === 'Resolved' && 'onAction' in child
    );

    act(() => {
      if (resolvedAction && 'onAction' in resolvedAction) {
        resolvedAction.onAction();
      }
    });

    await userEvent.click(await screen.findByRole('button', {name: 'Confirm'}));

    expect(bulkUpdateMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/issues/`,
      expect.objectContaining({
        query: expect.objectContaining({query: 'is:unresolved'}),
      })
    );
    expect(bulkUpdateMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({id: expect.anything()}),
      })
    );
  });
});
