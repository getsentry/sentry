import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {VisualizeFunction} from 'sentry/views/explore/queryParams/visualize';
import {
  findSuggestedColumns,
  removeHiddenKeys,
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
