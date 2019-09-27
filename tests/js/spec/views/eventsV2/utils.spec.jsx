import {mount} from 'enzyme';
import {browserHistory} from 'react-router';

import {initializeOrg} from 'app-test/helpers/initializeOrg';
import {
  getFieldRenderer,
  getAggregateAlias,
  getEventTagSearchUrl,
  decodeColumnOrderAndColumnSortBy,
  encodeColumnOrderAndColumnSortBy,
  setColumnStateOnLocation,
} from 'app/views/eventsV2/utils';

describe('eventTagSearchUrl()', function() {
  let location;
  beforeEach(function() {
    location = {
      pathname: '/organization/org-slug/events/',
      query: {},
    };
  });

  it('adds a query', function() {
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:firefox'},
    });
  });

  it('removes eventSlug', function() {
    location.query.eventSlug = 'project-slug:deadbeef';
    expect(getEventTagSearchUrl('browser', 'firefox 69', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'browser:"firefox 69"'},
    });
  });

  it('appends to an existing query', function() {
    location.query.query = 'failure';
    expect(getEventTagSearchUrl('browser', 'firefox', location)).toEqual({
      pathname: location.pathname,
      query: {query: 'failure browser:firefox'},
    });
  });
});

describe('getAggregateAlias', function() {
  it('no-ops simple fields', function() {
    expect(getAggregateAlias('field')).toEqual('field');
    expect(getAggregateAlias('under_field')).toEqual('under_field');
  });

  it('handles 0 arg functions', function() {
    expect(getAggregateAlias('count()')).toEqual('count');
    expect(getAggregateAlias('count_unique()')).toEqual('count_unique');
  });

  it('handles 1 arg functions', function() {
    expect(getAggregateAlias('count(id)')).toEqual('count_id');
    expect(getAggregateAlias('count_unique(user)')).toEqual('count_unique_user');
    expect(getAggregateAlias('count_unique(issue.id)')).toEqual('count_unique_issue_id');
  });
});

describe('getFieldRenderer', function() {
  let location, context, project, organization, data;
  beforeEach(function() {
    context = initializeOrg({
      project: TestStubs.Project(),
    });
    organization = context.organization;
    project = context.project;

    location = {
      pathname: '/events',
      query: {},
    };
    data = {
      title: 'ValueError: something bad',
      transaction: 'api.do_things',
      boolValue: 1,
      numeric: 1.23,
      createdAt: new Date(2019, 9, 3, 12, 13, 14),
      url: '/example',
      latest_event: 'deadbeef',
      'project.name': project.slug,
    };
  });

  it('can render string fields', function() {
    const renderer = getFieldRenderer('url', {url: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));
    const link = wrapper.find('QueryLink');
    expect(link).toHaveLength(1);
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {query: 'url:/example'},
    });
    expect(link.text()).toEqual(data.url);
  });

  it('can render boolean fields', function() {
    const renderer = getFieldRenderer('boolValue', {boolValue: 'boolean'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));
    const link = wrapper.find('QueryLink');
    expect(link).toHaveLength(1);
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {query: 'boolValue:1'},
    });
  });

  it('can render integer fields', function() {
    const renderer = getFieldRenderer('numeric', {numeric: 'integer'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('Count');
    expect(value).toHaveLength(1);
    expect(value.props().value).toEqual(data.numeric);
  });

  it('can render date fields', function() {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(1);
    expect(value.props().date).toEqual(data.createdAt);
  });

  it('can render null date fields', function() {
    const renderer = getFieldRenderer('nope', {nope: 'date'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('StyledDateTime');
    expect(value).toHaveLength(0);
    expect(wrapper.text()).toEqual('n/a');
  });

  it('can render transaction as a link', function() {
    const renderer = getFieldRenderer('transaction', {transaction: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('OverflowLink');
    expect(value).toHaveLength(1);
    expect(value.props().to).toEqual({
      pathname: location.pathname,
      query: {
        eventSlug: `${project.slug}:deadbeef`,
      },
    });
    expect(value.text()).toEqual(data.transaction);
  });

  it('can render title as a link', function() {
    const renderer = getFieldRenderer('title', {title: 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(renderer(data, {location, organization}));

    const value = wrapper.find('OverflowLink');
    expect(value).toHaveLength(1);
    expect(value.props().to).toEqual({
      pathname: location.pathname,
      query: {
        eventSlug: `${project.slug}:deadbeef`,
      },
    });
    expect(value.text()).toEqual(data.title);
  });

  it('can render project as an avatar', function() {
    const renderer = getFieldRenderer('project', {'project.name': 'string'});
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const value = wrapper.find('ProjectBadge');
    expect(value).toHaveLength(1);
    expect(value.props().project).toEqual(project);
  });

  it('can coerce string field to a link', function() {
    const renderer = getFieldRenderer('url', {url: 'string'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    // No basic link should be present.
    expect(wrapper.find('QueryLink')).toHaveLength(0);

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {
        eventSlug: `${project.slug}:deadbeef`,
      },
    });
    expect(link.text()).toEqual('/example');
  });

  it('can coerce number field to a link', function() {
    const renderer = getFieldRenderer('numeric', {numeric: 'number'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {
        eventSlug: `${project.slug}:deadbeef`,
      },
    });
    expect(link.find('Count').props().value).toEqual(data.numeric);
  });

  it('can coerce date field to a link', function() {
    const renderer = getFieldRenderer('createdAt', {createdAt: 'date'}, true);
    expect(renderer).toBeInstanceOf(Function);
    const wrapper = mount(
      renderer(data, {location, organization}),
      context.routerContext
    );

    const link = wrapper.find('OverflowLink');
    expect(link.props().to).toEqual({
      pathname: location.pathname,
      query: {
        eventSlug: `${project.slug}:deadbeef`,
      },
    });
    expect(link.find('StyledDateTime').props().date).toEqual(data.createdAt);
  });
});

describe('decodeColumnOrderAndColumnSortBy', function() {
  it('can decode 0 elements', function() {
    const location = {query: {}};
    const table = decodeColumnOrderAndColumnSortBy(location);

    expect(Array.isArray(table.columnOrder)).toBeTruthy();
    expect(Array.isArray(table.columnSortBy)).toBeTruthy();
    expect(table.columnOrder).toHaveLength(0);
    expect(table.columnSortBy).toHaveLength(0);
  });

  it('can decode 1 element (typed as a string)', function() {
    const location = {
      query: {
        field: 'a',
        alias: 'ant',
        sort: 'a',
      },
    };
    const table = decodeColumnOrderAndColumnSortBy(location);

    expect(Array.isArray(table.columnOrder)).toBeTruthy();
    expect(Array.isArray(table.columnSortBy)).toBeTruthy();
    expect(table.columnOrder).toHaveLength(1);
    expect(table.columnSortBy).toHaveLength(1);

    expect(table.columnOrder[0]).toMatchObject({
      key: 'a',
      name: 'ant',
      aggregation: '',
      field: 'a',
    });
    expect(table.columnSortBy[0]).toMatchObject({
      key: 'a',
      order: 'asc',
    });
  });

  it('can decode 2+ element (typed as an array)', function() {
    const location = {
      query: {
        field: ['a', 'b'],
        alias: ['ant', 'bee'],
        sort: ['-a'],
      },
    };
    const table = decodeColumnOrderAndColumnSortBy(location);

    expect(Array.isArray(table.columnOrder)).toBeTruthy();
    expect(Array.isArray(table.columnSortBy)).toBeTruthy();
    expect(table.columnOrder).toHaveLength(2);
    expect(table.columnSortBy).toHaveLength(1);

    expect(table.columnOrder[0]).toMatchObject({
      key: 'a',
      name: 'ant',
      aggregation: '',
      field: 'a',
    });
    expect(table.columnOrder[1]).toMatchObject({
      key: 'b',
      name: 'bee',
      aggregation: '',
      field: 'b',
    });
    expect(table.columnSortBy[0]).toMatchObject({
      key: 'a',
      order: 'desc',
    });
  });

  it('can decode elements with aggregate functions', function() {
    const location = {
      query: {
        field: ['a(b)'],
        alias: ['antbee'],
        sort: ['-a(b)'],
      },
    };
    const table = decodeColumnOrderAndColumnSortBy(location);

    expect(Array.isArray(table.columnOrder)).toBeTruthy();
    expect(Array.isArray(table.columnSortBy)).toBeTruthy();
    expect(table.columnOrder).toHaveLength(1);
    expect(table.columnSortBy).toHaveLength(1);

    expect(table.columnOrder[0]).toMatchObject({
      key: 'a(b)',
      name: 'antbee',
      aggregation: 'a',
      field: 'b',
    });
    expect(table.columnSortBy[0]).toMatchObject({
      key: 'a(b)',
      order: 'desc',
    });
  });
});

describe('encodeColumnOrderAndColumnSortBy', function() {
  it('can encode 0 elements', function() {
    const table = {
      columnOrder: [],
      columnSortBy: [],
    };

    const query = encodeColumnOrderAndColumnSortBy(table);

    expect(Array.isArray(query.alias)).toBeTruthy();
    expect(Array.isArray(query.field)).toBeTruthy();
    expect(Array.isArray(query.sort)).toBeTruthy();
    expect(query.alias).toHaveLength(0);
    expect(query.field).toHaveLength(0);
    expect(query.sort).toHaveLength(0);
  });

  it('can encode an array of elements', function() {
    const table = {
      columnOrder: [
        {
          key: 'a',
          name: 'ant',
          aggregation: '',
          field: 'a',
        },
        {
          key: 'a(b)',
          name: 'antbee',
          aggregation: 'a',
          field: 'b',
        },
      ],
      columnSortBy: [
        {
          key: 'a',
          order: 'asc',
        },
        {
          key: 'a(b)',
          order: 'desc',
        },
      ],
    };

    const query = encodeColumnOrderAndColumnSortBy(table);
    expect(Array.isArray(query.alias)).toBeTruthy();
    expect(Array.isArray(query.field)).toBeTruthy();
    expect(Array.isArray(query.sort)).toBeTruthy();

    expect(query.alias).toHaveLength(2);
    expect(query.alias[0]).toBe('ant');
    expect(query.alias[1]).toBe('antbee');

    expect(query.field).toHaveLength(2);
    expect(query.field[0]).toBe('a');
    expect(query.field[1]).toBe('a(b)');

    expect(query.sort).toHaveLength(2);
    expect(query.sort[0]).toBe('a');
    expect(query.sort[1]).toBe('-a(b)');
  });

  it('will build field using "aggregate(field)" when encoding', function() {
    const table = {
      columnOrder: [
        {
          key: 'someKey',
          name: 'antbee',
          aggregation: 'a',
          field: 'b',
        },
      ],
      columnSortBy: [],
    };

    const query = encodeColumnOrderAndColumnSortBy(table);
    expect(Array.isArray(query.alias)).toBeTruthy();
    expect(Array.isArray(query.field)).toBeTruthy();
    expect(Array.isArray(query.sort)).toBeTruthy();

    expect(query.alias).toHaveLength(1);
    expect(query.alias[0]).toBe('antbee');

    expect(query.field).toHaveLength(1);
    expect(query.field[0]).toBe('a(b)');
  });
});

describe('setColumnStateOnLocation', function() {
  const location = {
    boba: {
      fett: 'no',
      tea: 'yes',
    },
    query: {
      star: {
        trek: 'maybe',
        wars: 'perhaps',
      },
    },
  };
  let browserHistoryPush;

  beforeAll(() => {
    browserHistoryPush = browserHistory.push;
    browserHistory.push = jest.fn();
  });

  afterAll(() => {
    browserHistory.push = browserHistoryPush;
  });

  beforeEach(() => {
    browserHistory.push.mockClear();
  });

  it('will copy Location object correctly', function() {
    setColumnStateOnLocation(location, [], []);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        boba: expect.objectContaining({
          fett: expect.any(String),
          tea: expect.any(String),
        }),
        query: expect.objectContaining({
          star: expect.objectContaining({
            trek: expect.any(String),
            wars: expect.any(String),
          }),
        }),
      })
    );
  });

  it('will remove extraneous columnSortBy elements', function() {
    const table = {
      columnOrder: [
        {
          key: 'a',
          name: 'ant',
          aggregation: '',
          field: 'a',
        },
      ],
      columnSortBy: [
        {
          key: 'a',
          order: 'asc',
        },
        {
          key: 'a(b)',
          order: 'desc',
        },
      ],
    };

    setColumnStateOnLocation(location, table.columnOrder, table.columnSortBy);

    expect(browserHistory.push).toHaveBeenCalledWith(
      expect.objectContaining({
        query: expect.objectContaining({
          alias: expect.arrayContaining(['ant']),
          field: expect.arrayContaining(['a']),
          sort: expect.arrayContaining(['a']),
        }),
      })
    );
  });
});
