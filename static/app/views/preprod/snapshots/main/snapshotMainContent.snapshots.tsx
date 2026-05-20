import {Fragment} from 'react';
import {ThemeProvider} from '@emotion/react';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

import {
  ColorPickerButton,
  DiffModeToggle,
  ProgressCounter,
  ProgressPill,
  SoloDiffToggle,
  SortDropdown,
  ToolbarContainer,
  ToolbarProgressBar,
  ViewModeToggle,
} from './snapshotMainContent';

jest.mock('@sentry/scraps/compactSelect', () => {
  const {Button} = jest.requireActual('@sentry/scraps/button');
  const {IconChevron} = jest.requireActual('sentry/icons');
  return {
    CompactSelect: ({
      value,
      options,
      size,
    }: {
      options: Array<{label: string; value: string}>;
      value: string;
      size?: string;
    }) => {
      const selected = options.find(o => o.value === value);
      return (
        <Button size={size} icon={<IconChevron direction="down" />}>
          {selected?.label ?? value}
        </Button>
      );
    },
  };
});

jest.mock('./imageDisplay/useD3Zoom', () => {
  const ReactActual = jest.requireActual('react');
  const noop = () => {};
  const createZoom = () => ({
    containerRef: ReactActual.createRef(),
    resetZoom: noop,
    transform: {x: 0, y: 0, k: 1},
    zoomBehaviorRef: ReactActual.createRef(),
    zoomIn: noop,
    zoomOut: noop,
  });

  return {
    useD3Zoom: createZoom,
    useSyncedD3Zoom: () => [createZoom(), createZoom()],
  };
});

jest.mock('@sentry/scraps/tooltip', () => ({
  Tooltip: ({children}: {children: React.ReactNode}) => children,
}));

// eslint-disable-next-line no-restricted-syntax -- SSR snapshot rendering has no OrganizationContext provider
jest.mock('sentry/utils/useOrganization', () => ({
  useOrganization: () => ({slug: 'test-org', id: '1', name: 'Test Org'}),
}));

jest.mock('sentry/utils/analytics', () => ({
  trackAnalytics: jest.fn(),
}));

let mockBreakpoints: Record<string, boolean> = {};

jest.mock('sentry/utils/useBreakpoints', () => ({
  useBreakpoints: () => mockBreakpoints,
}));

const themes = {light: lightTheme, dark: darkTheme};
const noop = () => {};

const XS_BREAKPOINTS = {
  '2xs': true,
  xs: true,
  sm: false,
  md: false,
  lg: false,
  xl: false,
  '2xl': false,
};

const SM_BREAKPOINTS = {
  '2xs': true,
  xs: true,
  sm: true,
  md: false,
  lg: false,
  xl: false,
  '2xl': false,
};

const MD_BREAKPOINTS = {
  '2xs': true,
  xs: true,
  sm: true,
  md: true,
  lg: false,
  xl: false,
  '2xl': false,
};

describe('SnapshotMainContent Toolbar', () => {
  describe.each(['light', 'dark'] as const)('%s', themeName => {
    function Wrapper({children}: {children: React.ReactNode}) {
      return (
        <ThemeProvider theme={themes[themeName]}>
          <div style={{width: '100%'}}>{children}</div>
        </ThemeProvider>
      );
    }

    function progress(current: number, total: number) {
      const value = total <= 1 ? 100 : (current / (total - 1)) * 100;
      return (
        <ProgressPill>
          <ToolbarProgressBar value={value} />
          <ProgressCounter size="xs" variant="muted">
            {current + 1}/{total}
          </ProgressCounter>
        </ProgressPill>
      );
    }

    describe('xs', () => {
      beforeEach(() => {
        mockBreakpoints = XS_BREAKPOINTS;
      });

      it.snapshot(
        'full',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="list" onViewModeChange={noop} />}
              sortDropdown={<SortDropdown value="diff" onChange={noop} />}
              progressIndicator={progress(2, 10)}
              diffControls={
                <Fragment>
                  <DiffModeToggle diffMode="wipe" onDiffModeChange={noop} />
                </Fragment>
              }
              soloDiffToggle={
                <SoloDiffToggle isSoloView={false} onToggleSoloView={noop} />
              }
            />
          </Wrapper>
        ),
        {viewport: 'xs', metadata: {theme: themeName, state: 'full'}}
      );

      it.snapshot(
        'minimal',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="single" onViewModeChange={noop} />}
              progressIndicator={progress(0, 5)}
            />
          </Wrapper>
        ),
        {viewport: 'xs', metadata: {theme: themeName, state: 'minimal'}}
      );

      it.snapshot(
        'no-diff-controls',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="list" onViewModeChange={noop} />}
              sortDropdown={<SortDropdown value="alpha" onChange={noop} />}
              progressIndicator={progress(6, 20)}
              soloDiffToggle={<SoloDiffToggle isSoloView onToggleSoloView={noop} />}
            />
          </Wrapper>
        ),
        {viewport: 'xs', metadata: {theme: themeName, state: 'no-diff-controls'}}
      );
    });

    describe('sm', () => {
      beforeEach(() => {
        mockBreakpoints = SM_BREAKPOINTS;
      });

      it.snapshot(
        'full',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="list" onViewModeChange={noop} />}
              sortDropdown={<SortDropdown value="diff" onChange={noop} />}
              progressIndicator={progress(2, 10)}
              diffControls={
                <Fragment>
                  <ColorPickerButton color="transparent" onChange={noop} />
                  <DiffModeToggle diffMode="split" onDiffModeChange={noop} />
                </Fragment>
              }
              soloDiffToggle={
                <SoloDiffToggle isSoloView={false} onToggleSoloView={noop} />
              }
            />
          </Wrapper>
        ),
        {viewport: 'sm', metadata: {theme: themeName, state: 'full'}}
      );

      it.snapshot(
        'minimal',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="single" onViewModeChange={noop} />}
              progressIndicator={progress(0, 5)}
            />
          </Wrapper>
        ),
        {viewport: 'sm', metadata: {theme: themeName, state: 'minimal'}}
      );

      it.snapshot(
        'no-diff-controls',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="list" onViewModeChange={noop} />}
              sortDropdown={<SortDropdown value="alpha" onChange={noop} />}
              progressIndicator={progress(6, 20)}
              soloDiffToggle={<SoloDiffToggle isSoloView onToggleSoloView={noop} />}
            />
          </Wrapper>
        ),
        {viewport: 'sm', metadata: {theme: themeName, state: 'no-diff-controls'}}
      );
    });

    describe('md', () => {
      beforeEach(() => {
        mockBreakpoints = MD_BREAKPOINTS;
      });

      it.snapshot(
        'full',
        () => (
          <Wrapper>
            <ToolbarContainer
              toggle={<ViewModeToggle viewMode="list" onViewModeChange={noop} />}
              sortDropdown={<SortDropdown value="diff" onChange={noop} />}
              progressIndicator={progress(2, 10)}
              diffControls={
                <Fragment>
                  <ColorPickerButton color="transparent" onChange={noop} />
                  <DiffModeToggle diffMode="split" onDiffModeChange={noop} />
                </Fragment>
              }
              soloDiffToggle={
                <SoloDiffToggle isSoloView={false} onToggleSoloView={noop} />
              }
            />
          </Wrapper>
        ),
        {viewport: 'md', metadata: {theme: themeName, state: 'full'}}
      );
    });
  });
});
