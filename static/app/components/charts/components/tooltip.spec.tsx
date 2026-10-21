import type {CallbackDataParams} from 'echarts/types/dist/shared';

import {getFormatter} from './tooltip';

describe('getFormatter', () => {
  it('formats sub-labels with their own formatter and leaves them out of the total', () => {
    const formatter = getFormatter({
      valueFormatter: value => `${value} B`,
      subLabels: [
        {
          parentLabel: 'Client Discard',
          label: 'Queue Overflow',
          data: [{name: 'a', value: 200}],
        },
        {
          parentLabel: 'Client Discard',
          label: 'Queue Overflow (Count)',
          data: [{name: 'a', value: 2}],
          excludeFromTotal: true,
          valueFormatter: value => `${value} items`,
        },
      ],
    });

    const html = formatter(
      [
        {
          seriesName: 'Client Discard',
          dataIndex: 0,
          value: [1609459200000, 200],
          marker: '',
        } as CallbackDataParams,
      ],
      ''
    ) as string;

    expect(html).toContain('Queue Overflow</strong></span> 200 B');
    expect(html).toContain('Queue Overflow (Count)</strong></span> 2 items');
    expect(html).toContain('Total:</strong> 200 B');
  });
});
