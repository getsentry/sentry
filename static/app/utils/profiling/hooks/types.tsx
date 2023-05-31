import {DURATION_UNITS, SIZE_UNITS} from 'sentry/utils/discover/fieldRenderers';
import {FieldValueType} from 'sentry/utils/fields';

export type Unit = keyof typeof DURATION_UNITS | keyof typeof SIZE_UNITS | null;

export type EventsResultsDataRow<F extends string> = {
  [K in F]: string[] | string | number | null;
};

export type EventsResultsMeta<F extends string> = {
  fields: Partial<{[K in F]: FieldValueType}>;
  units: Partial<{[K in F]: Unit}>;
};

export type EventsResults<F extends string> = {
  data: EventsResultsDataRow<F>[];
  meta: EventsResultsMeta<F>;
};

export type Sort<F> = {
  key: F;
  order: 'asc' | 'desc';
};
