import {LocationFixture} from 'sentry-fixture/locationFixture';
import {ProjectFixture} from 'sentry-fixture/project';

import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Visualize} from 'sentry/views/explore/contexts/pageParamsContext/visualizes';
import {findSuggestedColumns, viewSamplesTarget} from 'sentry/views/explore/utils';

describe('viewSamplesTarget', function () {
  const project = ProjectFixture();
  const projects = [project];
  const visualize = new Visualize('count(span.duration)');
  const sort = {
    field: 'count(span.duration)',
    kind: 'desc' as const,
  };

  it('simple drill down with no group bys', function () {
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

  it('simple drill down with single group by', function () {
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

  it('simple drill down with multiple group bys', function () {
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

  it('simple drill down with on environment', function () {
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

  it('simple drill down with on project id', function () {
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

  it('simple drill down with on project slug', function () {
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
});

describe('findSuggestedColumns', function () {
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
  ])(
    'should inject $cols when changing from `$oldQuery` to `$newQuery`',
    function ({cols, oldQuery, newQuery}) {
      const oldSearch = new MutableSearch(oldQuery);
      const newSearch = new MutableSearch(newQuery);
      const suggestion = findSuggestedColumns(newSearch, oldSearch, {
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
