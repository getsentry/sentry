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
import {IssueListCommandPaletteActions} from 'sentry/views/issueList/issueListCommandPaletteActions';
import {IssueSelectionProvider} from 'sentry/views/issueList/issueSelectionContext';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

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

async function getSortLabels(
  organization: ReturnType<typeof OrganizationFixture>,
  sort: IssueSortOptions
) {
  const treeRef: {current: Array<CollectionTreeNode<CMDKActionData>>} = {current: []};

  render(
    <CommandPaletteProvider>
      <IssueSelectionProvider visibleGroupIds={['1']}>
        <IssueListCommandPaletteActions
          groupIds={['1']}
          onActionTaken={jest.fn()}
          onQueryChange={jest.fn()}
          onSortChange={jest.fn()}
          query=""
          queryCount={1}
          selection={{
            projects: [1],
            environments: [],
            datetime: {start: null, end: null, period: null, utc: true},
          }}
          sort={sort}
        />
      </IssueSelectionProvider>
      <SlotOutlets />
      <CommandPaletteTree onTree={tree => (treeRef.current = tree)} />
    </CommandPaletteProvider>,
    {organization}
  );

  await waitFor(() => expect(treeRef.current.length).toBeGreaterThan(0));

  const sortNode = treeRef.current
    .find(node => node.display.label === 'Issues Feed')
    ?.children.find(child => child.display.label?.startsWith('Sort by:'));

  return sortNode?.children.map(child => child.display.label) ?? [];
}

describe('IssueListCommandPaletteActions sort', () => {
  beforeEach(() => {
    ConfigStore.loadInitialData({
      user: UserFixture({id: '1', name: 'Test User'}),
    } as any);
    MockApiClient.addMockResponse({url: '/organizations/org-slug/users/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/members/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/tags/', body: []});
    MockApiClient.addMockResponse({url: '/organizations/org-slug/projects/', body: []});
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('offers Recommended when it is the default sort so users can switch back', async () => {
    const organization = OrganizationFixture({
      features: ['issue-stream-recommended-sort-default'],
    });

    const labels = await getSortLabels(organization, IssueSortOptions.DATE);

    expect(labels).toContain('Recommended');
  });

  it('omits Recommended when the org has no recommended-sort flag', async () => {
    const organization = OrganizationFixture({features: []});

    const labels = await getSortLabels(organization, IssueSortOptions.DATE);

    expect(labels).not.toContain('Recommended');
    expect(labels).toContain('Last Seen');
  });
});
