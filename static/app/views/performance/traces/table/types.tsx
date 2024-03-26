import type {ReactText} from 'react';

import type {SpanIndexedFieldTypes} from 'sentry/views/starfish/types';

export type ColumnKey = ReactText;

type DataType = string[] | string | number | null;

export type DataRow = Partial<SpanIndexedFieldTypes> & {[key: string]: DataType};
