/**
 * Selectable color palettes for dashboard chart widgets.
 *
 * TODO: These colors are placeholders and need review by a data visualization
 * or design expert before this ships. Known gaps:
 * - They are hard-coded hex values rather than theme tokens, and there is a
 *   single variant shared by light and dark mode.
 * - They have not been checked for contrast against chart backgrounds. The
 *   gradient palettes run from near-white to near-black, so their ends are hard
 *   to see in one theme or the other.
 * - Only "Accessible" is based on a published colorblind-safe scheme. The rest
 *   have not been checked for color vision deficiencies.
 *
 * Where a palette matches a published source it is credited below; the matches
 * were identified by eye and should be confirmed as part of that review.
 */
export type ChartPaletteId =
  | 'default'
  | 'cool'
  | 'warm'
  | 'business'
  | 'accessible'
  | 'gradientBlue'
  | 'gradientGreen'
  | 'highContrast';

// Last three colors appear to be from the Flat UI "American" palette; the rest are unattributed.
const COOL: readonly string[] = [
  '#2A78D6',
  '#1BCCCC',
  '#1BAF7A',
  '#4A3AA7',
  '#6C5CE7',
  '#0984E3',
  '#00B894',
];

// Includes Sentry's categorical magenta, salmon and orange chart tokens; the rest are unattributed.
const WARM: readonly string[] = [
  '#EB6834',
  '#E34948',
  '#E87BA4',
  '#EDA100',
  '#FA6769',
  '#B82D90',
  '#FF9838',
];

// Appears to match Flat UI Colors (flatuicolors.com).
const BUSINESS: readonly string[] = [
  '#2C3E50',
  '#3498DB',
  '#1ABC9C',
  '#9B59B6',
  '#34495E',
  '#2980B9',
  '#16A085',
];

// Appears to match Paul Tol's "bright" qualitative scheme, designed to be colorblind safe.
const ACCESSIBLE: readonly string[] = [
  '#4477AA',
  '#EE6677',
  '#228833',
  '#CCBB44',
  '#66CCEE',
  '#AA3377',
  '#BBBBBB',
];

// Unattributed light-to-dark ramp.
const GRADIENT_BLUE: readonly string[] = [
  '#E6F1FB',
  '#85B7EB',
  '#378ADD',
  '#185FA5',
  '#0C447C',
  '#042C53',
  '#021B33',
];

// Unattributed light-to-dark ramp.
const GRADIENT_GREEN: readonly string[] = [
  '#EAF3DE',
  '#97C459',
  '#639922',
  '#3B6D11',
  '#27500A',
  '#173404',
  '#0C1C02',
];

// Appears to match the "Dutch Field" data visualization palette.
const HIGH_CONTRAST: readonly string[] = [
  '#E60049',
  '#0BB4FF',
  '#50E991',
  '#E6D800',
  '#9B19F5',
  '#FFA300',
  '#DC0AB4',
];

const CUSTOM_PALETTES: Record<string, readonly string[]> = {
  cool: COOL,
  warm: WARM,
  business: BUSINESS,
  accessible: ACCESSIBLE,
  gradientBlue: GRADIENT_BLUE,
  gradientGreen: GRADIENT_GREEN,
  highContrast: HIGH_CONTRAST,
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
  {id: 'cool', label: 'Cool', colors: COOL},
  {id: 'warm', label: 'Warm', colors: WARM},
  {id: 'business', label: 'Business', colors: BUSINESS},
  {id: 'accessible', label: 'Accessible', colors: ACCESSIBLE},
  {id: 'gradientBlue', label: 'Gradient blue', colors: GRADIENT_BLUE},
  {id: 'gradientGreen', label: 'Gradient green', colors: GRADIENT_GREEN},
  {id: 'highContrast', label: 'High contrast', colors: HIGH_CONTRAST},
];
