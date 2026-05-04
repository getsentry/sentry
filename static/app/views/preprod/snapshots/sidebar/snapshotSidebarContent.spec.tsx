import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotSidebarContent, type SidebarSection} from './snapshotSidebarContent';

const noop = () => {};

const statusCounts: Record<DiffStatus, number> = {
  [DiffStatus.CHANGED]: 1,
  [DiffStatus.ADDED]: 0,
  [DiffStatus.REMOVED]: 0,
  [DiffStatus.RENAMED]: 0,
  [DiffStatus.UNCHANGED]: 1,
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
    />
  );
}

describe('SnapshotSidebarContent', () => {
  it('renders displayName in the sidebar, not the key', () => {
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

    expect(screen.getByText('MyPreview')).toBeInTheDocument();
    expect(screen.queryByText('com.example.MyClass.MyPreview')).not.toBeInTheDocument();
  });

  it('shows group name as displayName when group is set', () => {
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

    expect(screen.getByText('components')).toBeInTheDocument();
  });
});
