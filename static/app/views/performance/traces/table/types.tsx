import type {ReactText} from 'react';

import type {IndexedResponse} from 'sentry/views/starfish/types';

export type ColumnKey = ReactText;

type DataType = string[] | string | number | null;

export type DataRow = Partial<IndexedResponse> & {[key: string]: DataType};
