import {t} from 'sentry/locale';
import {Actions} from 'sentry/views/discover/table/cellAction';

// NOTE: This is a subset! Some types like `"string"`, `"date"`, and
// `"percent_change"` are not supported yet. Once we support them, we can remove
// this constant and any code that checks it.
export const PLOTTABLE_TIME_SERIES_VALUE_TYPES = [
  'number',
  'integer',
  'duration',
  'percentage',
  'size',
  'rate',
  'score',
  'currency',
] as const;

export const MIN_WIDTH = 110;
export const MIN_HEIGHT = 96;

export const DEFAULT_FIELD = 'unknown'; // Numeric data might, in theory, have a missing field. In this case we need a fallback to provide to the field rendering pipeline. `'unknown'` will results in rendering as a string

export const MISSING_DATA_MESSAGE = t('No Data');
export const NO_PLOTTABLE_VALUES = t('The data does not contain any plottable values.');
export const NON_FINITE_NUMBER_MESSAGE = t('Value is not a finite number.');

// TODO: Increase precision once we support per-series value types.
// Currently we lose precision for actual number fields because we
// can't distinguish them from percentage-like fields that need capping.
export const NUMBER_MAX_FRACTION_DIGITS = 4;
export const NUMBER_MIN_VALUE = 10 ** -NUMBER_MAX_FRACTION_DIGITS;

export const ALLOWED_CELL_ACTIONS = [
  Actions.OPEN_INTERNAL_LINK,
  Actions.COPY_TO_CLIPBOARD,
  Actions.OPEN_EXTERNAL_LINK,
];
