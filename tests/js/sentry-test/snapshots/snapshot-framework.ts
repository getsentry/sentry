/* eslint-disable unicorn/filename-case */
import type {ReactElement} from 'react';

import {Tooltip as mockTooltip} from 'sentry-test/snapshots/mocks/tooltip';

// eslint-disable-next-line no-restricted-imports -- SSR snapshot rendering needs direct theme access
import {lightTheme} from 'sentry/utils/theme/theme';

import {closeBrowser, takeSnapshot} from './snapshot';
import type {SnapshotTestMetadata} from './snapshot-image-metadata';

// Tooltip portals to document.body, unavailable under SSR; mock globally.
jest.mock('@sentry/scraps/tooltip', () => ({Tooltip: mockTooltip}));

const BREAKPOINT_WIDTHS = Object.fromEntries(
  Object.entries(lightTheme.breakpoints).map(([k, v]) => [k, parseInt(v, 10)])
) as Record<keyof typeof lightTheme.breakpoints, number>;

type BreakpointName = keyof typeof BREAKPOINT_WIDTHS;

type SnapshotViewport = BreakpointName | number | {width: number; height?: number};

type SnapshotTestInput = SnapshotTestMetadata & {viewport?: SnapshotViewport};

interface SnapshotDetails {
  displayName: string;
  fileSlug: string;
  group: string | null;
  theme?: 'light' | 'dark';
}

/**
 * Parses Jest's `currentTestName` to extract snapshot details.
 *
 * Jest joins describe blocks and test name with spaces, e.g.:
 *   "Button dark snapshot: default"
 *
 * We split on the " snapshot: " marker (added by snapshotTest) to separate:
 *   - group: the describe ancestry ("Button dark" -> "Button/dark")
 *   - displayName: the test name passed to it.snapshot ("default")
 *   - fileSlug: a path-safe filename combining both ("button/dark/default")
 */
function parseSnapshotDetails(testName: string, fallbackName: string): SnapshotDetails {
  const parts = testName.split(' snapshot: ');
  if (parts.length < 2) {
    return {
      displayName: fallbackName,
      fileSlug: fallbackName.toLowerCase(),
      group: null,
      theme: undefined,
    };
  }

  const ancestry = parts[0]!.trim();
  const group = ancestry.replace(/\s+/g, '/');
  const displayName = parts[1]!.trim();
  const fileSlug = `${group}/${displayName}`.replace(/\s+/g, '').toLowerCase();
  const themeMatch = ancestry.match(/\b(light|dark)\b/)?.[1];

  return {
    displayName,
    fileSlug,
    group,
    theme: themeMatch === 'light' || themeMatch === 'dark' ? themeMatch : undefined,
  };
}

function resolveViewport(input: SnapshotViewport): {
  label: string;
  width: number;
  height?: number;
} {
  if (typeof input === 'string') {
    const width = BREAKPOINT_WIDTHS[input];
    if (width <= 0) {
      throw new Error(
        `Breakpoint "${input}" resolves to ${width}px — too small for a snapshot`
      );
    }
    return {width, label: input};
  }
  if (typeof input === 'number') {
    const name = Object.entries(BREAKPOINT_WIDTHS).find(([, w]) => w === input)?.[0];
    return {width: input, label: name ?? `${input}w`};
  }
  const name = Object.entries(BREAKPOINT_WIDTHS).find(([, w]) => w === input.width)?.[0];
  return {width: input.width, height: input.height, label: name ?? `${input.width}w`};
}

function snapshotTest(
  name: string,
  renderFn: () => ReactElement,
  metadata: SnapshotTestInput = {}
): void {
  const {viewport: viewportInput, ...restMetadata} = metadata;

  const resolved = viewportInput ? resolveViewport(viewportInput) : undefined;

  const suffix = resolved ? ' @' + resolved.label : '';

  test('snapshot: ' + name + suffix, async () => {
    const {testPath, currentTestName} = expect.getState();
    if (!testPath) {
      throw new Error('Could not determine test file path');
    }

    const details = parseSnapshotDetails(currentTestName ?? '', name);

    const viewportSuffix = resolved ? `@${resolved.label}` : '';
    const displayName = details.displayName;
    const fileSlug = viewportSuffix
      ? details.fileSlug.replace(new RegExp(`${viewportSuffix}$`, 'i'), '')
      : details.fileSlug;
    const finalFileSlug = resolved ? `${fileSlug}-${resolved.label}` : fileSlug;

    await takeSnapshot({
      fileSlug: finalFileSlug,
      displayName,
      renderFn,
      testFilePath: testPath,
      group: details.group,
      theme: details.theme,
      metadata: restMetadata,
      viewport: resolved ? {width: resolved.width, height: resolved.height} : undefined,
      viewportLabel: resolved?.label,
    });
  });
}

snapshotTest.each = function snapshotEach<T>(table: T[]) {
  return (
    name: string,
    renderFn: (value: T) => ReactElement,
    metadataFn?: (value: T) => SnapshotTestInput
  ) => {
    for (const value of table) {
      const testName = name.replace('%s', String(value));
      snapshotTest(testName, () => renderFn(value), metadataFn?.(value));
    }
  };
};

snapshotTest.breakpoints = function snapshotBreakpoints(
  breakpoints: BreakpointName[],
  name: string,
  renderFn: (width: number) => ReactElement,
  metadata: SnapshotTestMetadata = {}
): void {
  for (const bp of breakpoints) {
    const width = BREAKPOINT_WIDTHS[bp];
    snapshotTest(name, () => renderFn(width), {...metadata, viewport: bp});
  }
};

afterAll(async () => {
  await closeBrowser();
});

test.snapshot = snapshotTest;

declare global {
  namespace jest {
    interface It {
      snapshot: typeof snapshotTest & {
        breakpoints: (
          breakpoints: BreakpointName[],
          name: string,
          renderFn: (width: number) => ReactElement,
          metadata?: SnapshotTestMetadata
        ) => void;
        each: <T>(
          table: T[]
        ) => (
          name: string,
          renderFn: (value: T) => ReactElement,
          metadataFn?: (value: T) => SnapshotTestInput
        ) => void;
      };
    }
  }
}
