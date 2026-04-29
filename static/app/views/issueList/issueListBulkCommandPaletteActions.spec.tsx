import {useLayoutEffect} from 'react';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

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
import {
  IssueSelectionProvider,
  useIssueSelectionActions,
} from 'sentry/views/issueList/issueSelectionContext';

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
    ConfigStore.loadInitialData({
      user: UserFixture({id: '1', name: 'Test User'}),
    } as any);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [],
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
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
});
