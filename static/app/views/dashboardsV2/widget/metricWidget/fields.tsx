export type MetricsColumnType = 'set' | 'counter';

export enum FieldKey {
  SESSION = 'session',
  USER = 'user',
}

export const METRICS_FIELDS: Readonly<Record<FieldKey, MetricsColumnType>> = {
  [FieldKey.SESSION]: 'counter',
  [FieldKey.USER]: 'set',
};

export const METRICS_AGGREGATIONS = {
  count_unique: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['set'],
        defaultValue: FieldKey.USER,
        required: true,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
  sum: {
    parameters: [
      {
        kind: 'column',
        columnTypes: ['counter'],
        required: true,
        defaultValue: FieldKey.SESSION,
      },
    ],
    outputType: 'number',
    isSortable: true,
    multiPlotType: 'area',
  },
};
