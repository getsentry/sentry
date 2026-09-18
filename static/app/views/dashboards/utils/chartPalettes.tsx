/**
 * Selectable color palettes for dashboard chart widgets.
 *
 * Every palette here is a published, freely licensed scheme, copied verbatim
 * from the source named above it. Do not add colors without a license to match.
 *
 * TODO: The selection still needs review by a data visualization or design
 * expert before this ships. Known gaps:
 * - These are hard-coded hex values rather than theme tokens, with a single
 *   variant shared by light and dark mode.
 * - Contrast against Sentry's chart backgrounds has not been checked in either
 *   theme.
 * - The Tol schemes are designed to be colorblind safe and viridis and plasma to
 *   be perceptually uniform, but none of that has been verified in our charts.
 * - Viridis and Plasma are sequential ramps used here for categorical series,
 *   so neighbouring series get similar colors.
 */
export type ChartPaletteId =
  | 'default'
  | 'tolBright'
  | 'tolVibrant'
  | 'tolMuted'
  | 'brewerDark2'
  | 'brewerSet2'
  | 'viridis'
  | 'plasma';

// Paul Tol's qualitative colour schemes.
// Copyright (c) 2022, Paul Tol. All rights reserved. BSD 3-Clause License.
// https://sronpersonalpages.nl/~pault/
const TOL_BRIGHT: readonly string[] = [
  '#4477AA',
  '#EE6677',
  '#228833',
  '#CCBB44',
  '#66CCEE',
  '#AA3377',
  '#BBBBBB',
];

const TOL_VIBRANT: readonly string[] = [
  '#EE7733',
  '#0077BB',
  '#33BBEE',
  '#EE3377',
  '#CC3311',
  '#009988',
  '#BBBBBB',
];

const TOL_MUTED: readonly string[] = [
  '#CC6677',
  '#332288',
  '#DDCC77',
  '#117733',
  '#88CCEE',
  '#882255',
  '#44AA99',
  '#999933',
  '#AA4499',
];

// ColorBrewer qualitative schemes "Dark2" and "Set2".
// Copyright (c) 2002 Cynthia Brewer, Mark Harrower, and The Pennsylvania State
// University. Licensed under the Apache License, Version 2.0.
// https://colorbrewer2.org/
const BREWER_DARK2: readonly string[] = [
  '#1B9E77',
  '#D95F02',
  '#7570B3',
  '#E7298A',
  '#66A61E',
  '#E6AB02',
  '#A6761D',
  '#666666',
];

const BREWER_SET2: readonly string[] = [
  '#66C2A5',
  '#FC8D62',
  '#8DA0CB',
  '#E78AC3',
  '#A6D854',
  '#FFD92F',
  '#E5C494',
  '#B3B3B3',
];

// The matplotlib "viridis" and "plasma" colormaps by Nathaniel J. Smith, Stefan
// van der Walt and Eric Firing, released under CC0 (public domain).
// https://github.com/BIDS/colormap
// Seven evenly spaced samples over the 10%-90% range of each map. The ends are
// left out because they are close to black and to pale yellow.
const VIRIDIS: readonly string[] = [
  '#482576',
  '#3D4E8A',
  '#2D718E',
  '#21918C',
  '#2AB07F',
  '#65CB5E',
  '#BDDF26',
];

const PLASMA: readonly string[] = [
  '#43039E',
  '#7801A8',
  '#A72197',
  '#CC4778',
  '#E76F5A',
  '#F99A3E',
  '#FCCE25',
];

const CUSTOM_PALETTES: Record<string, readonly string[]> = {
  tolBright: TOL_BRIGHT,
  tolVibrant: TOL_VIBRANT,
  tolMuted: TOL_MUTED,
  brewerDark2: BREWER_DARK2,
  brewerSet2: BREWER_SET2,
  viridis: VIRIDIS,
  plasma: PLASMA,
};

export function getCustomPalette(id: string | undefined): readonly string[] | undefined {
  if (!id || id === 'default') {
    return undefined;
  }
  return CUSTOM_PALETTES[id];
}

export const CHART_PALETTE_OPTIONS: Array<{
  colors: readonly string[];
  id: ChartPaletteId;
  label: string;
}> = [
  {id: 'default', label: 'Default', colors: []},
  {id: 'tolBright', label: 'Bright', colors: TOL_BRIGHT},
  {id: 'tolVibrant', label: 'Vibrant', colors: TOL_VIBRANT},
  {id: 'tolMuted', label: 'Muted', colors: TOL_MUTED},
  {id: 'brewerDark2', label: 'Bold', colors: BREWER_DARK2},
  {id: 'brewerSet2', label: 'Soft', colors: BREWER_SET2},
  {id: 'viridis', label: 'Viridis', colors: VIRIDIS},
  {id: 'plasma', label: 'Plasma', colors: PLASMA},
];
