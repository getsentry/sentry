import {t} from 'sentry/locale';

export const ALERTS = {
  latency: {
    aggregate: 'avg(g:spans/messaging.message.receive.latency@millisecond)',
    query: 'span.op:queue.process',
    name: t('Create Time in Queue Alert'),
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
    query: 'span.op:queue.process',
    name: t('Create Processing Time Alert'),
  },
  processed: {
    aggregate: 'spm()',
    query: 'span.op:queue.process',
    name: t('Create Processed Alert'),
  },
  published: {
    aggregate: 'spm()',
    query: 'span.op:queue.publish',
    name: t('Create Published Alert'),
  },
};
