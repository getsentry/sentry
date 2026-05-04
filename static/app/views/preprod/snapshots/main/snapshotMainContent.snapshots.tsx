import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

jest.mock('@sentry/scraps/badge', () => ({
  Tag: ({children, ...props}: {children: React.ReactNode}) => (
    <span {...props}>{children}</span>
  ),
}));

jest.mock('@sentry/scraps/button', () => ({
  Button: ({
    children,
    ...props
  }: {
    children?: React.ReactNode;
    icon?: React.ReactNode;
  }) => (
    <button {...props}>
      {props.icon}
      {children}
    </button>
  ),
}));

jest.mock('@sentry/scraps/compactSelect', () => ({
  CompactSelect: () => <select />,
}));

jest.mock('@sentry/scraps/segmentedControl', () => {
  function SegmentedControl({children}: {children: React.ReactNode}) {
    return <div>{children}</div>;
  }
  SegmentedControl.Item = function ({children}: {children?: React.ReactNode}) {
    return <span>{children}</span>;
  };
  return {SegmentedControl};
});

jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

jest.mock('sentry/components/progressBar', () => ({
  ProgressBar: () => <div />,
}));

jest.mock('sentry/icons', () => ({
  IconArrow: () => <span>↑</span>,
  IconExpand: () => <span>⊞</span>,
  IconInput: () => <span>⊟</span>,
  IconList: () => <span>☰</span>,
  IconPause: () => <span>‖</span>,
  IconStack: () => <span>⊞</span>,
}));

jest.mock('./imageDisplay/diffImageDisplay', () => ({
  DiffImageDisplay: () => <div />,
  TRANSPARENT_COLOR: 'transparent',
}));

jest.mock('./imageDisplay/singleImageDisplay', () => ({
  SingleImageDisplay: () => <div />,
}));

jest.mock('./snapshotCards', () => ({
  CardHeader: () => <div />,
  DarkAware: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
}));

jest.mock('./snapshotFrames', () => ({
  SnapshotCardFrame: ({children}: {children: React.ReactNode}) => <div>{children}</div>,
  SnapshotVariantFrame: ({children}: {children: React.ReactNode}) => (
    <div>{children}</div>
  ),
}));

jest.mock('./snapshotListView', () => ({
  buildSnapshotLink: () => '',
  isItemUngrouped: () => true,
  SnapshotListView: () => <div />,
}));

jest.mock('sentry/utils/useCopyToClipboard', () => ({
  useCopyToClipboard: () => ({copy: jest.fn()}),
}));

import {SnapshotsToolbar} from './snapshotMainContent';

const themes = {light: lightTheme, dark: darkTheme};

function Pill({label}: {label: string}) {
  return (
    <div
      style={{
        alignItems: 'center',
        background: '#e8e5f0',
        borderRadius: 4,
        display: 'inline-flex',
        fontFamily: 'monospace',
        fontSize: 11,
        height: 24,
        padding: '0 8px',
      }}
    >
      {label}
    </div>
  );
}

const toggle = <Pill label="List | Single" />;
const sortDropdown = <Pill label="Sort: Diff %" />;
const progressIndicator = <Pill label="3/12" />;
const diffControls = (
  <div style={{display: 'flex', gap: 4}}>
    <Pill label="Color" />
    <Pill label="Split | Wipe | Onion" />
  </div>
);
const soloDiffToggle = <Pill label="Diff | Head" />;

describe('SnapshotsToolbar', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    it.snapshot(
      'all-slots',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar
              toggle={toggle}
              sortDropdown={sortDropdown}
              progressIndicator={progressIndicator}
              diffControls={diffControls}
              soloDiffToggle={soloDiffToggle}
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'all-slots'}
    );

    it.snapshot(
      'no-diff-controls',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar
              toggle={toggle}
              sortDropdown={sortDropdown}
              progressIndicator={progressIndicator}
              soloDiffToggle={soloDiffToggle}
            />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'no-diff-controls'}
    );

    it.snapshot(
      'toggle-only',
      () => (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: 960}}>
            <SnapshotsToolbar toggle={toggle} />
          </div>
        </ThemeProvider>
      ),
      {theme: themeName, state: 'toggle-only'}
    );
  });
});
