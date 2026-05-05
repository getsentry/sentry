import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';
import {DiffStatus} from 'sentry/views/preprod/types/snapshotTypes';

import {SnapshotSidebarContent, type SidebarSection} from './snapshotSidebarContent';

jest.mock('@sentry/scraps/layout', () => {
  const actual = jest.requireActual('@sentry/scraps/layout');
  return {
    ...actual,
    Stack: (props: any) => <actual.Flex direction="column" {...props} />,
  };
});

const themes = {light: lightTheme, dark: darkTheme};

const noop = () => {};

const sections: SidebarSection[] = [
  {
    type: DiffStatus.CHANGED,
    groups: [
      {key: 'changed:Button/light', name: 'Button/light', count: 1},
      {key: 'changed:Alert/dark', name: 'Alert/dark', count: 3},
    ],
  },
  {
    type: DiffStatus.UNCHANGED,
    groups: [
      {key: 'unchanged:Badge/light', name: 'Badge/light', count: 4},
      {key: 'unchanged:Checkbox/theme-dark', name: 'Checkbox/theme-dark', count: 2},
    ],
  },
];

const statusCounts: Record<DiffStatus, number> = {
  [DiffStatus.CHANGED]: 2,
  [DiffStatus.ADDED]: 0,
  [DiffStatus.REMOVED]: 0,
  [DiffStatus.RENAMED]: 0,
  [DiffStatus.UNCHANGED]: 2,
};

describe('SnapshotSidebarContent', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{height: 520, width: 350}}>{children}</div>
        </ThemeProvider>
      );
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
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'default'}
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
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'active-group'}
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
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'filtered'}
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
          />
        </Wrapper>
      ),
      {theme: themeName, state: 'no-results'}
    );
  });
});
