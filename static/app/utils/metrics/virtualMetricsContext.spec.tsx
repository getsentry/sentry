import {
  createMRIToVirtualMap,
  createSpanAttributeProjectIdMap,
} from 'sentry/utils/metrics/virtualMetricsContext';

describe('createMRIToVirtualMap', () => {
  it('creates a mapping', () => {
    const rules = [
      {
        spanAttribute: 'span1',
        projectId: 1,
        aggregates: [],
        tags: [],
        unit: 'none',
        conditions: [
          {
            id: 1,
            value: 'value',
            mris: ['c:custom/mri1@none' as const, 'c:custom/mri2@none' as const],
          },
        ],
      },
      {
        spanAttribute: 'span2',
        projectId: 2,
        aggregates: [],
        tags: [],
        unit: 'millisecond',
        conditions: [
          {
            id: 2,
            value: 'value',
            mris: ['c:custom/mri3@none' as const, 'c:custom/mri4@none' as const],
          },
        ],
      },
    ];
    const result = createMRIToVirtualMap(rules);
    expect(result).toEqual(
      new Map([
        ['c:custom/mri1@none', 'v:custom/span1|1@none'],
        ['c:custom/mri2@none', 'v:custom/span1|1@none'],
        ['c:custom/mri3@none', 'v:custom/span2|2@millisecond'],
        ['c:custom/mri4@none', 'v:custom/span2|2@millisecond'],
      ])
    );
  });
});

describe('createSpanAttributeProjectIdMap', () => {
  it('creates a mapping', () => {
    const rules = [
      {
        spanAttribute: 'span1',
        projectId: 1,
        aggregates: [],
        tags: [],
        unit: 'none',
        conditions: [
          {
            id: 1,
            value: 'value',
            mris: ['c:custom/mri1@none' as const, 'c:custom/mri2@none' as const],
          },
        ],
      },
      {
        spanAttribute: 'span2',
        projectId: 2,
        aggregates: [],
        tags: [],
        unit: 'none',
        conditions: [
          {
            id: 2,
            value: 'value',
            mris: ['c:custom/mri3@none' as const, 'c:custom/mri4@none' as const],
          },
        ],
      },
    ];
    const result = createSpanAttributeProjectIdMap(rules);
    expect(result).toEqual(
      new Map([
        ['span1', [1]],
        ['span2', [2]],
      ])
    );
  });
});
