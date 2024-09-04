export const ALERTS = {
  latency: {
    aggregate: 'avg(g:spans/messaging.message.receive.latency@millisecond)',
    query: 'span.op:queue.process',
    name: 'Create Time in Queue Alert',
  },
  duration: {
    aggregate: 'avg(d:spans/duration@millisecond)',
    query: 'span.op:queue.process',
    name: 'Create Processing Time Alert',
  },
  processed: {
    aggregate: 'spm()',
    query: 'span.op:queue.process',
    name: 'Create Processed Alert',
  },
  published: {
    aggregate: 'spm()',
    query: 'span.op:queue.publish',
    name: 'Create Published Alert',
  },
};
