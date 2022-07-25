import {RuntimeData} from 'sentry/components/events/contexts/runtime/types';

export const runtimeMockData = {
  version: '1.7.13',
  type: 'runtime',
  build: '2.7.18 (default, Apr 20 2020, 19:34:11) \n[GCC 8.3.0]',
  name: '',
} as unknown as RuntimeData;

export const runtimeMetaMockData = {
  name: {
    '': {
      chunks: [
        {
          remark: 'x',
          rule_id: 'project:0',
          text: '',
          type: 'redaction',
        },
      ],
      len: 98,
      rem: [['project:0', 'x', 0, 0]],
    },
  },
};

describe('runtime event context', function () {
  it.todo('display redacted data'); // Data Scrubbing has a couple of bugs that we need to address before creating a test for this
});
