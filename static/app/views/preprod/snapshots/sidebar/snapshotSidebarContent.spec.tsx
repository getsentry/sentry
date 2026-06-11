import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotSidebarContent, type SidebarSection} from './snapshotSidebarContent';

const noop = () => {};

beforeEach(() => {
  jest.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    width: 350,
    height: 600,
    top: 0,
    left: 0,
    bottom: 600,
    right: 350,
    x: 0,
    y: 0,
    toJSON: jest.fn(),
  });
});

const statusCounts: Record<DiffStatus, number> = {
  [DiffStatus.CHANGED]: 1,
  [DiffStatus.ADDED]: 0,
  [DiffStatus.REMOVED]: 0,
  [DiffStatus.RENAMED]: 0,
  [DiffStatus.UNCHANGED]: 1,
  [DiffStatus.SKIPPED]: 0,
};

function renderSidebar(sections: SidebarSection[]) {
  return render(
    <SnapshotSidebarContent
      sections={sections}
      searchQuery=""
      onSearchChange={noop}
      onSelectItem={noop}
      statusCounts={statusCounts}
      activeStatuses={new Set()}
      onToggleStatus={noop}
      availableTags={new Map()}
    />
  );
}

describe('SnapshotSidebarContent', () => {
  it('renders displayName in the sidebar, not the key', async () => {
    renderSidebar([
      {
        type: DiffStatus.CHANGED,
        groups: [
          {
            key: 'changed:com.example.MyClass.MyPreview',
            displayName: 'MyPreview',
            count: 1,
          },
        ],
      },
    ]);

    expect(await screen.findByText('MyPreview')).toBeInTheDocument();
    expect(screen.queryByText('com.example.MyClass.MyPreview')).not.toBeInTheDocument();
  });

  it('shows group name as displayName when group is set', async () => {
    renderSidebar([
      {
        type: DiffStatus.UNCHANGED,
        groups: [
          {
            key: 'unchanged:components',
            displayName: 'components',
            count: 3,
          },
        ],
      },
    ]);

    expect(await screen.findByText('components')).toBeInTheDocument();
  });
});
