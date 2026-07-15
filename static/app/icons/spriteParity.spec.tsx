/* eslint-disable import/no-nodejs-modules -- reads/writes the SVG sources on disk */
import fs from 'node:fs';
import path from 'node:path';
/* eslint-enable import/no-nodejs-modules */

import type {ComponentType, ReactElement} from 'react';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';

import * as icons from 'sentry/icons';
import {IconGraphArea} from 'sentry/icons/iconGraphArea';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import {IconGraphCircle} from 'sentry/icons/iconGraphCircle';
import {IconGraphHeatmap} from 'sentry/icons/iconGraphHeatmap';
import {IconGraphLine} from 'sentry/icons/iconGraphLine';
import {IconGraphScatter} from 'sentry/icons/iconGraphScatter';
import {IconParenthesis} from 'sentry/icons/iconParenthesis';

/**
 * Guards the @sentry/icons SVG sources against drift from the legacy icon
 * components: every legacy icon (and prop variant) must have a source file
 * in static/icons/src that renders the exact same geometry. Delete this
 * spec together with the legacy components once the migration is done.
 *
 * To (re)extract the sources from the legacy components, run:
 *   ICON_SPRITE_WRITE=1 pnpm test-ci static/app/icons/spriteParity.spec.tsx
 */
const SRC_DIR = path.join(__dirname, '../../icons/src');

interface Variant {
  name: string;
  props?: Record<string, unknown>;
  /**
   * Post-processes the extracted markup, for variants the legacy component
   * implements with CSS on the outer element (which a sprite symbol cannot
   * carry).
   */
  wrap?: (inner: string) => string;
}

// Icons whose extra props select distinct geometry get one sprite symbol
// per variant. Rotation-only props (direction on arrow/chevron/panel/thumb)
// are intentionally absent: the new <Icon> handles rotation itself.
const VARIANTS: Record<string, Variant[]> = {
  IconBookmark: [{name: 'bookmark'}, {name: 'bookmark-solid', props: {isSolid: true}}],
  IconChevron: [{name: 'chevron'}, {name: 'chevron-double', props: {isDouble: true}}],
  IconFocus: [{name: 'focus'}, {name: 'focus-off', props: {isFocused: false}}],
  IconLab: [{name: 'lab'}, {name: 'lab-solid', props: {isSolid: true}}],
  IconLock: [{name: 'lock-open'}, {name: 'lock', props: {locked: true}}],
  IconPin: [{name: 'pin'}, {name: 'pin-solid', props: {isSolid: true}}],
  IconSort: [{name: 'sort'}, {name: 'sort-rotated', props: {rotated: true}}],
  IconStar: [{name: 'star'}, {name: 'star-solid', props: {isSolid: true}}],
  IconZoom: [{name: 'zoom-out'}, {name: 'zoom-in', props: {isZoomIn: true}}],
  IconParenthesis: [
    {name: 'parenthesis'},
    {
      name: 'parenthesis-right',
      wrap: inner => `<g transform="rotate(180 2.5 13)">${inner}</g>`,
    },
  ],
  // kebab() does not split the trailing digits
  IconRewind10: [{name: 'rewind-10'}],
};

const SKIP = new Set([
  'IconDefaultsProvider',
  // Delegates to the IconGraph* components covered via DIRECT below
  'IconGraph',
]);

// Icon components that are not exported from the barrel
const DIRECT = {
  IconGraphArea,
  IconGraphBar,
  IconGraphCircle,
  IconGraphHeatmap,
  IconGraphLine,
  IconGraphScatter,
  IconParenthesis,
};

function isIconComponent(value: unknown): value is ComponentType<any> {
  return typeof value === 'function';
}

function kebab(exportName: string) {
  return exportName
    .replace(/^Icon/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1-$2')
    .toLowerCase();
}

function toSvgSource(element: ReactElement, wrapInner?: Variant['wrap']) {
  const markup = renderToStaticMarkup(element);
  const match = markup.match(/^<svg([^>]*)>([\s\S]*)<\/svg>$/);
  if (!match) {
    throw new Error(`Unexpected icon markup: ${markup.slice(0, 120)}`);
  }
  const [, attrs = '', content = ''] = match;
  const viewBox = attrs.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) {
    throw new Error('Icon rendered without a viewBox');
  }
  const inner = wrapInner ? wrapInner(content) : content;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">${inner}</svg>\n`;
}

interface Case {
  component: ComponentType<any>;
  title: string;
  variant: Variant;
}

const cases: Case[] = [];

for (const [exportName, component] of [
  ...Object.entries(icons),
  ...Object.entries(DIRECT),
]) {
  if (
    !/^Icon[A-Z]/.test(exportName) ||
    !isIconComponent(component) ||
    SKIP.has(exportName)
  ) {
    continue;
  }
  for (const variant of VARIANTS[exportName] ?? [{name: kebab(exportName)}]) {
    cases.push({component, title: `${exportName} → ${variant.name}`, variant});
  }
}

describe('@sentry/icons sprite parity', () => {
  it('covers every legacy icon export', () => {
    expect(cases.length).toBeGreaterThan(150);
    expect(new Set(cases.map(c => c.variant.name)).size).toBe(cases.length);
  });

  it.each(cases)('$title', ({component, variant}) => {
    const source = toSvgSource(createElement(component, variant.props), variant.wrap);
    const file = path.join(SRC_DIR, `${variant.name}.svg`);

    if (process.env.ICON_SPRITE_WRITE) {
      fs.writeFileSync(file, source);
      return;
    }

    expect(fs.existsSync(file)).toBe(true);
    expect(fs.readFileSync(file, 'utf8')).toBe(source);
  });
});
