import type {CategoricalSeries} from 'sentry/views/dashboards/widgets/common/types';

export const sampleLongLabelData: CategoricalSeries = {
  valueAxis: 'count()',
  meta: {
    valueType: 'integer',
    valueUnit: null,
  },
  values: [
    {category: 'AuthenticationServiceProvider', value: 450},
    {category: 'DatabaseConnectionManager', value: 320},
    {category: 'NotificationDispatchWorker', value: 280},
    {category: 'ScheduledTaskOrchestrator', value: 195},
    {category: 'WebSocketEventBroadcaster', value: 150},
  ],
};
