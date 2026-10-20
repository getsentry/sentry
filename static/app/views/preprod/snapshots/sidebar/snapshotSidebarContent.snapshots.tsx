import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotSidebarContent, type SidebarSection} from './snapshotSidebarContent';

jest.mock('@sentry/scraps/layout', () => {
  const actual = jest.requireActual('@sentry/scraps/layout');
  return {
    ...actual,
    Stack: (props: any) => <actual.Flex direction="column" {...props} />,
  };
});

const noop = () => {};

const sections: SidebarSection[] = [
  {
    type: DiffStatus.CHANGED,
    groups: [
      {key: 'changed:Button/light', displayName: 'Button/light', count: 1},
      {key: 'changed:Alert/dark', displayName: 'Alert/dark', count: 3},
    ],
  },
  {
    type: DiffStatus.UNCHANGED,
    groups: [
      {key: 'unchanged:Badge/light', displayName: 'Badge/light', count: 4},
      {
        key: 'unchanged:Checkbox/theme-dark',
        displayName: 'Checkbox/theme-dark',
        count: 2,
      },
    ],
  },
];

const statusCounts: Record<DiffStatus, number> = {
  [DiffStatus.CHANGED]: 2,
  [DiffStatus.ADDED]: 0,
  [DiffStatus.REMOVED]: 0,
  [DiffStatus.RENAMED]: 0,
  [DiffStatus.UNCHANGED]: 2,
  [DiffStatus.ERRORED]: 0,
  [DiffStatus.SKIPPED]: 0,
};

describe('SnapshotSidebarContent', () => {
  function Wrapper({children}: {children: React.ReactNode}) {
    return <div style={{height: 520, width: 350}}>{children}</div>;
  }

  it.snapshot(
    'default',
    () => (
      <Wrapper>
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
      </Wrapper>
    ),
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'active-group',
    () => (
      <Wrapper>
        <SnapshotSidebarContent
          sections={sections}
          activeItemKey="unchanged:Badge/light"
          searchQuery=""
          onSearchChange={noop}
          onSelectItem={noop}
          statusCounts={statusCounts}
          activeStatuses={new Set()}
          onToggleStatus={noop}
          availableTags={new Map()}
        />
      </Wrapper>
    ),
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'filtered',
    () => (
      <Wrapper>
        <SnapshotSidebarContent
          sections={sections}
          searchQuery=""
          onSearchChange={noop}
          onSelectItem={noop}
          statusCounts={statusCounts}
          activeStatuses={new Set([DiffStatus.UNCHANGED])}
          onToggleStatus={noop}
          availableTags={new Map()}
        />
      </Wrapper>
    ),
    {tags: {area: 'snapshots'}}
  );

  it.snapshot(
    'no-results',
    () => (
      <Wrapper>
        <SnapshotSidebarContent
          sections={[]}
          searchQuery="missing"
          onSearchChange={noop}
          onSelectItem={noop}
          statusCounts={statusCounts}
          activeStatuses={new Set([DiffStatus.CHANGED, DiffStatus.UNCHANGED])}
          onToggleStatus={noop}
          availableTags={new Map()}
        />
      </Wrapper>
    ),
    {tags: {area: 'snapshots'}}
  );
});
