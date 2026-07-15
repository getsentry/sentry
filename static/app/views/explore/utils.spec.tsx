import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';
import {TimeSeriesFixture} from 'sentry-fixture/timeSeries';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {TimeSeries} from 'sentry/views/dashboards/widgets/common/types';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  findSuggestedColumns,
  getSamplingWarningReason,
  isSamplingSensitiveAggregate,
  removeHiddenKeys,
  shouldWarnSamplingSensitive,
  viewSamplesTarget,
} from 'sentry/views/explore/utils';

describe('viewSamplesTarget', () => {
  const project = ProjectFixture();
  const projects = [project];
  const visualize = new VisualizeFunction('count(span.duration)');
  const sort = {
    field: 'count(span.duration)',
    kind: 'desc' as const,
  };

  it('simple drill down with no group bys', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: [],
      visualizes: [visualize],
      sorts: [sort],
      row: {},
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: '',
        sort: ['-span.duration'],
      },
    });
  });

  it('simple drill down with single group by', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['bar'],
      visualizes: [visualize],
      sorts: [sort],
      row: {bar: 'bar', 'count(span.duration)': 10},
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: 'bar:bar',
        sort: ['-span.duration'],
      },
    });
  });

  it('simple drill down with multiple group bys', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['bar', 'baz'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        bar: 'bar',
        baz: 'baz',
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: 'bar:bar baz:baz',
        sort: ['-span.duration'],
      },
    });
  });

  it('simple drill down with on environment', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['environment'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        environment: 'prod',
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: '',
        environment: 'prod',
        sort: ['-span.duration'],
      },
    });
  });

  it('simple drill down with on project id', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['project.id'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        'project.id': 1,
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: '',
        project: '1',
        sort: ['-span.duration'],
      },
    });
  });

  it('simple drill down with on project slug', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['project'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        project: project.slug,
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: '',
        project: String(project.id),
        sort: ['-span.duration'],
      },
    });
  });

  it('drill down with numeric group by value', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['org_id'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        org_id: 123,
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: 'org_id:123',
        sort: ['-span.duration'],
      },
    });
  });

  it('drill down replaces existing filter for the same key', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: 'bar:old_value',
      fields: ['foo'],
      groupBys: ['bar'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        bar: 'new_value',
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: 'bar:new_value',
        sort: ['-span.duration'],
      },
    });
  });

  it('drill down preserves existing filters for different keys', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: 'existing_key:existing_value',
      fields: ['foo'],
      groupBys: ['bar'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        bar: 'bar',
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: 'existing_key:existing_value bar:bar',
        sort: ['-span.duration'],
      },
    });
  });

  it('drill down with no value group by uses !has filter', () => {
    const location = LocationFixture();
    const target = viewSamplesTarget({
      location,
      query: '',
      fields: ['foo'],
      groupBys: ['user.id'],
      visualizes: [visualize],
      sorts: [sort],
      row: {
        'user.id': undefined,
        'count(span.duration)': 10,
      },
      projects,
    });
    expect(target).toMatchObject({
      query: {
        field: ['foo', 'span.duration'],
        mode: 'samples',
        query: '!has:user.id',
        sort: ['-span.duration'],
      },
    });
  });
});

describe('findSuggestedColumns', () => {
  it.each([
    {
      cols: [],
      oldQuery: '',
      newQuery: '',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:value',
    },
    {
      cols: ['key'],
      oldQuery: 'key:value1',
      newQuery: 'key:[value1,value2]',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:[value1,value2]',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: '!key:value',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:*',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:v*',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:\\*',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:v\\*',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:\\\\*',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:v\\\\*',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:\\\\\\*',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:v\\\\\\*',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'has:key',
    },
    {
      cols: [],
      oldQuery: 'key:value',
      newQuery: 'has:key',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'key:value has:key',
    },
    {
      cols: ['key'],
      oldQuery: '',
      newQuery: 'key:[value1,value2] has:key',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: '!has:a',
    },
    {
      cols: ['num'],
      oldQuery: '',
      newQuery: 'num:>0',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'foo:[a,b]',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'count():>0',
    },
    {
      cols: [],
      oldQuery: '',
      newQuery: 'boolean:true',
    },
  ])(
    'should inject $cols when changing from `$oldQuery` to `$newQuery`',
    ({cols, oldQuery, newQuery}) => {
      const oldSearch = new MutableSearch(oldQuery);
      const newSearch = new MutableSearch(newQuery);
      const suggestion = findSuggestedColumns(newSearch, oldSearch, {
        booleanAttributes: {
          boolean: {key: 'boolean', name: 'boolean'},
        },
        numberAttributes: {
          num: {key: 'num', name: 'num'},
        },
        stringAttributes: {
          key: {key: 'key', name: 'key'},
        },
      });
      expect(new Set(suggestion)).toEqual(new Set(cols));
    }
  );
});

describe('removeHiddenKeys', () => {
  it('removes keys that match the hidden list', () => {
    const tags: TagCollection = {
      'log.field': {key: 'log.field', name: 'log.field', kind: FieldKind.TAG},
      project_id: {key: 'project_id', name: 'project_id', kind: FieldKind.TAG},
    };

    expect(removeHiddenKeys(tags, ['project_id'])).toEqual({
      'log.field': {key: 'log.field', name: 'log.field', kind: FieldKind.TAG},
    });
  });

  it('removes explicitly-typed keys by their display name', () => {
    const tags: TagCollection = {
      'log.duration': {
        key: 'log.duration',
        name: 'log.duration',
        kind: FieldKind.MEASUREMENT,
      },
      // Number attributes are keyed by their explicit form but display the
      // base name, which is what the hidden lists contain.
      'tags[project_id,number]': {
        key: 'tags[project_id,number]',
        name: 'project_id',
        kind: FieldKind.MEASUREMENT,
      },
    };

    expect(removeHiddenKeys(tags, ['project_id'])).toEqual({
      'log.duration': {
        key: 'log.duration',
        name: 'log.duration',
        kind: FieldKind.MEASUREMENT,
      },
    });
  });

  it('keeps attributes whose name only partially matches a hidden key', () => {
    const tags: TagCollection = {
      prev_project_id: {
        key: 'prev_project_id',
        name: 'prev_project_id',
        kind: FieldKind.MEASUREMENT,
      },
      'tags[message.parameter.project_id,number]': {
        key: 'tags[message.parameter.project_id,number]',
        name: 'message.parameter.project_id',
        kind: FieldKind.MEASUREMENT,
      },
    };

    expect(removeHiddenKeys(tags, ['project_id'])).toEqual(tags);
  });
});

function seriesWithSampleRates(sampleRates: Array<number | null>): TimeSeries[] {
  return [
    TimeSeriesFixture({
      values: sampleRates.map((sampleRate, index) => ({
        value: 1,
        timestamp: 1729796400000 + index,
        sampleRate,
      })),
    }),
  ];
}

describe('isSamplingSensitiveAggregate', () => {
  it.each(['count_unique(user)', 'failure_count()', 'failure_rate()'])(
    'returns true for sampling-sensitive aggregate %s',
    aggregate => {
      expect(isSamplingSensitiveAggregate(aggregate)).toBe(true);
    }
  );

  it.each(['count()', 'avg(span.duration)', 'p50(span.duration)'])(
    'returns false for non-sensitive aggregate %s',
    aggregate => {
      expect(isSamplingSensitiveAggregate(aggregate)).toBe(false);
    }
  );
});

describe('shouldWarnSamplingSensitive', () => {
  it('returns true when there is a sensitive aggregate and the average sample rate is below the threshold', () => {
    expect(
      shouldWarnSamplingSensitive(
        'count_unique(user)',
        seriesWithSampleRates([0.05, 0.05])
      )
    ).toBe(true);
  });

  it('returns false when the average sample rate is at or above the threshold', () => {
    expect(
      shouldWarnSamplingSensitive('count_unique(user)', seriesWithSampleRates([1, 1]))
    ).toBe(false);
  });

  it('returns false when there is no sample rate data', () => {
    expect(
      shouldWarnSamplingSensitive(
        'count_unique(user)',
        seriesWithSampleRates([null, null])
      )
    ).toBe(false);
  });

  it('returns false for a non-sensitive aggregate even with a low sample rate', () => {
    expect(
      shouldWarnSamplingSensitive('count()', seriesWithSampleRates([0.05, 0.05]))
    ).toBe(false);
  });
});

describe('getSamplingWarningReason', () => {
  it('returns null for a non-sensitive aggregate even when partially scanned', () => {
    expect(
      getSamplingWarningReason('count()', seriesWithSampleRates([0.05, 0.05]), 'partial')
    ).toBeNull();
  });

  it('returns partialData when sensitive and partially scanned, regardless of sample rate', () => {
    expect(
      getSamplingWarningReason(
        'count_unique(user)',
        seriesWithSampleRates([1, 1]),
        'partial'
      )
    ).toBe('partialData');
  });

  it('returns lowSampleRate when sensitive, fully scanned, and below the threshold', () => {
    expect(
      getSamplingWarningReason(
        'count_unique(user)',
        seriesWithSampleRates([0.05, 0.05]),
        'full'
      )
    ).toBe('lowSampleRate');
  });

  it('returns null when sensitive, fully scanned, and the sample rate is high', () => {
    expect(
      getSamplingWarningReason(
        'count_unique(user)',
        seriesWithSampleRates([1, 1]),
        'full'
      )
    ).toBeNull();
  });

  it('returns null when sensitive, fully scanned, and there is no sample rate data', () => {
    expect(
      getSamplingWarningReason(
        'count_unique(user)',
        seriesWithSampleRates([null, null]),
        'full'
      )
    ).toBeNull();
  });

  it('returns null when partially scanned but the series has no plotted data', () => {
    expect(getSamplingWarningReason('count_unique(user)', [], 'partial')).toBeNull();
  });

  it('returns null when the series only contains empty timeseries', () => {
    expect(
      getSamplingWarningReason('count_unique(user)', seriesWithSampleRates([]), 'partial')
    ).toBeNull();
  });
});
