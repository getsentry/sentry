import EventView, {
  isAPIPayloadSimilar,
  pickRelevantLocationQueryStrings,
} from 'app/utils/discover/eventView';
import {COL_WIDTH_UNDEFINED} from 'app/components/gridEditable/utils';
import {
  CHART_AXIS_OPTIONS,
  DisplayModes,
  DISPLAY_MODE_OPTIONS,
} from 'app/utils/discover/types';

const generateFields = fields =>
  fields.map(field => ({
    field,
  }));

const generateSorts = sorts =>
  sorts.map(sortName => ({
    field: sortName,
    kind: 'desc',
  }));

describe('EventView constructor', function () {
  it('instantiates default values', function () {
    const eventView = new EventView({});

    expect(eventView).toMatchObject({
      id: undefined,
      name: undefined,
      fields: [],
      sorts: [],
      query: '',
      project: [],
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: [],
      yAxis: undefined,
      display: undefined,
    });
  });
});

describe('EventView.fromLocation()', function () {
  it('maps query strings', function () {
    const location = {
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: [123],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '14d',
        environment: ['staging'],
        yAxis: 'p95',
        display: 'previous',
      },
    };

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts(['count']),
      query: 'event.type:transaction',
      project: [123],
      start: undefined,
      end: undefined,
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'p95',
      display: 'previous',
    });
  });

  it('includes first valid statsPeriod', function () {
    const location = {
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: [123],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: ['invalid', '28d'],
        environment: ['staging'],
      },
    };

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts(['count']),
      query: 'event.type:transaction',
      project: [123],
      start: undefined,
      end: undefined,
      statsPeriod: '28d',
      environment: ['staging'],
    });
  });

  it('includes start and end', function () {
    const location = {
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        widths: ['123', '456'],
        sort: ['title', '-count'],
        query: 'event.type:transaction',
        project: [123],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        environment: ['staging'],
      },
    };

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'id', width: 456},
      ],
      sorts: generateSorts(['count']),
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      environment: ['staging'],
    });
  });

  it('generates event view when there are no query strings', function () {
    const location = {
      query: {},
    };

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: void 0,
      name: void 0,
      fields: [],
      sorts: [],
      query: '',
      project: [],
      start: void 0,
      end: void 0,
      statsPeriod: '14d',
      environment: [],
      yAxis: void 0,
    });
  });
});

describe('EventView.fromSavedQuery()', function () {
  it('maps basic properties of saved query', function () {
    const saved = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      query: 'event.type:transaction',
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
      display: 'previous',
    };
    const eventView = EventView.fromSavedQuery(saved);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: undefined,
      display: 'previous',
    });

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      range: undefined,
    });
    expect(eventView2).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [
        {field: 'count()', width: COL_WIDTH_UNDEFINED},
        {field: 'id', width: COL_WIDTH_UNDEFINED},
      ],
      sorts: [{field: 'id', kind: 'desc'}],
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      statsPeriod: undefined,
      environment: ['staging'],
    });
  });

  it('maps saved query with no conditions', function () {
    const saved = {
      orderby: '-count',
      name: 'foo bar',
      fields: ['release', 'count()'],
      widths: [111, 222],
      dateCreated: '2019-10-30T06:13:17.632078Z',
      environment: ['dev', 'production'],
      version: 2,
      createdBy: '1',
      dateUpdated: '2019-10-30T06:13:17.632096Z',
      id: '5',
      projects: [1],
      yAxis: 'count()',
    };

    const eventView = EventView.fromSavedQuery(saved);

    const expected = {
      id: '5',
      name: 'foo bar',
      fields: [
        {field: 'release', width: 111},
        {field: 'count()', width: 222},
      ],
      sorts: generateSorts(['count']),
      query: '',
      project: [1],
      environment: ['dev', 'production'],
      yAxis: 'count()',
    };

    expect(eventView).toMatchObject(expected);
  });

  it('maps properties from v2 saved query', function () {
    const saved = {
      name: 'best query',
      fields: ['count()', 'title'],
      range: '14d',
      start: '',
      end: '',
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.fields).toEqual([
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
      {field: 'title', width: COL_WIDTH_UNDEFINED},
    ]);
    expect(eventView.name).toEqual(saved.name);
    expect(eventView.statsPeriod).toEqual('14d');
    expect(eventView.start).toEqual(undefined);
    expect(eventView.end).toEqual(undefined);
  });

  it('saved queries are equal when start and end datetime differ in format', function () {
    const saved = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      createdBy: '1',
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      start: '2019-10-20T21:02:51Z',
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(true);

    const eventView3 = EventView.fromSavedQuery({
      ...saved,
      start: '2019-10-20T21:02:51Z',
    });

    expect(eventView.isEqualTo(eventView3)).toBe(true);

    const eventView4 = EventView.fromSavedQuery({
      ...saved,
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView4)).toBe(true);
  });

  it('saved queries are not equal when datetime selection are invalid', function () {
    const saved = {
      orderby: '-count_timestamp',
      end: '2019-10-23T19:27:04+0000',
      name: 'release query',
      fields: ['release', 'count(timestamp)'],
      dateCreated: '2019-10-30T05:10:23.718937Z',
      environment: ['dev', 'production'],
      start: '2019-10-20T21:02:51+0000',
      version: 2,
      createdBy: '1',
      dateUpdated: '2019-10-30T07:25:58.291917Z',
      id: '3',
      projects: [1],
    };

    const eventView = EventView.fromSavedQuery(saved);

    const eventView2 = EventView.fromSavedQuery({
      ...saved,
      start: '',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(false);

    const eventView3 = EventView.fromSavedQuery({
      ...saved,
      end: '',
    });

    expect(eventView.isEqualTo(eventView3)).toBe(false);

    // this is expected since datetime (start and end) are normalized
    expect(eventView2.isEqualTo(eventView3)).toBe(true);
  });
});

describe('EventView.fromNewQueryWithLocation()', function () {
  const prebuiltQuery = {
    id: undefined,
    name: 'All Events',
    query: '',
    projects: [],
    fields: ['title', 'event.type', 'project', 'user', 'timestamp'],
    orderby: '-timestamp',
    version: 2,
  };

  it('maps basic properties of a prebuilt query', function () {
    const location = {
      query: {
        statsPeriod: '99d',
      },
    };

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'All Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [],
      start: undefined,
      end: undefined,
      // statsPeriod has precedence
      statsPeriod: '99d',
      environment: [],
      yAxis: undefined,
    });
  });

  it('merges global selection values', function () {
    const location = {
      query: {
        statsPeriod: '99d',
        project: ['456'],
        environment: ['prod'],
      },
    };

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'All Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [456],
      start: undefined,
      end: undefined,
      statsPeriod: '99d',
      environment: ['prod'],
      yAxis: undefined,
    });
  });

  it('new query takes precedence over global selection values', function () {
    const location = {
      query: {
        statsPeriod: '99d',
        project: ['456'],
        environment: ['prod'],
      },
    };

    const prebuiltQuery2 = {
      ...prebuiltQuery,
      range: '42d',
      projects: [987],
      environment: ['staging'],
    };

    const eventView = EventView.fromNewQueryWithLocation(prebuiltQuery2, location);

    expect(eventView).toMatchObject({
      id: undefined,
      name: 'All Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [987],
      start: undefined,
      end: undefined,
      statsPeriod: '42d',
      environment: ['staging'],
      yAxis: undefined,
    });

    // also test start and end

    const location2 = {
      query: {
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        project: ['456'],
        environment: ['prod'],
      },
    };

    const prebuiltQuery3 = {
      ...prebuiltQuery,
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      projects: [987],
      environment: ['staging'],
    };

    const eventView2 = EventView.fromNewQueryWithLocation(prebuiltQuery3, location2);

    expect(eventView2).toMatchObject({
      id: undefined,
      name: 'All Events',
      fields: [
        {field: 'title'},
        {field: 'event.type'},
        {field: 'project'},
        {field: 'user'},
        {field: 'timestamp'},
      ],
      sorts: [{field: 'timestamp', kind: 'desc'}],
      query: '',
      project: [987],
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      statsPeriod: undefined,
      environment: ['staging'],
      yAxis: undefined,
    });
  });
});

describe('EventView.generateQueryStringObject()', function () {
  it('skips empty values', function () {
    const eventView = new EventView({
      fields: generateFields(['id', 'title']),
      sorts: [],
      project: [],
      environment: '',
      statsPeriod: '',
      start: null,
      end: undefined,
      yAxis: undefined,
      display: 'previous',
    });

    const expected = {
      id: undefined,
      name: undefined,
      field: ['id', 'title'],
      widths: [COL_WIDTH_UNDEFINED, COL_WIDTH_UNDEFINED],
      sort: [],
      query: '',
      project: [],
      environment: [],
      display: 'previous',
    };

    expect(eventView.generateQueryStringObject()).toEqual(expected);
  });

  it('generates query string object', function () {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [
        {field: 'count()', width: 123},
        {field: 'project.id', width: 456},
      ],
      sorts: generateSorts(['count']),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'count()',
      display: 'releases',
      interval: '1m',
    };

    const eventView = new EventView(state);

    const expected = {
      id: '1234',
      name: 'best query',
      field: ['count()', 'project.id'],
      widths: [123, 456],
      sort: ['-count'],
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'count()',
      display: 'releases',
      interval: '1m',
    };

    expect(eventView.generateQueryStringObject()).toEqual(expected);
  });

  it('encodes fields', function () {
    const eventView = new EventView({
      fields: [{field: 'id'}, {field: 'title'}],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    expect(query.field).toEqual(['id', 'title']);
  });

  it('returns a copy of data preventing mutation', function () {
    const eventView = new EventView({
      fields: [{field: 'id'}, {field: 'title'}],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    query.field.push('newthing');

    // Getting the query again should return the original values.
    const secondQuery = eventView.generateQueryStringObject();
    expect(secondQuery.field).toEqual(['id', 'title']);

    expect(query).not.toEqual(secondQuery);
  });
});

describe('EventView.getEventsAPIPayload()', function () {
  it('generates the API payload', function () {
    const eventView = new EventView({
      id: 34,
      name: 'amazing query',
      fields: generateFields(['id']),
      sorts: generateSorts(['id']),
      query: 'event.type:csp',
      project: [567],
      environment: ['prod'],
      yAxis: 'users',
      display: 'releases',
    });

    expect(eventView.getEventsAPIPayload({})).toEqual({
      field: ['id'],
      per_page: 50,
      sort: '-id',
      query: 'event.type:csp',
      project: ['567'],
      environment: ['prod'],
      statsPeriod: '14d',
    });
  });

  it('does not append query conditions in location', function () {
    const eventView = new EventView({
      fields: generateFields(['id']),
      sorts: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        query: 'TypeError',
      },
    };
    expect(eventView.getEventsAPIPayload(location).query).toEqual('event.type:csp');
  });

  it('only includes at most one sort key', function () {
    const eventView = new EventView({
      fields: generateFields(['count()', 'title']),
      sorts: generateSorts(['title', 'count']),
      query: 'event.type:csp',
    });

    const location = {
      query: {},
    };

    expect(eventView.getEventsAPIPayload(location).sort).toEqual('-title');
  });

  it('only includes sort keys that are defined in fields', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      query: 'event.type:csp',
    });

    const location = {
      query: {},
    };

    expect(eventView.getEventsAPIPayload(location).sort).toEqual('-count');
  });

  it('only includes relevant query strings', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      query: 'event.type:csp',
    });

    const location = {
      query: {
        start: '2020-08-12 12:13:14',
        end: '2020-08-26 12:13:14',
        utc: 'true',
        statsPeriod: '14d',
        cursor: 'some cursor',
        yAxis: 'count()',

        // irrelevant query strings
        bestCountry: 'canada',
        project: '1234',
        environment: ['staging'],
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: [],
      environment: [],
      utc: 'true',
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes default coerced statsPeriod when omitted or is invalid', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      query: 'event.type:csp',
      project: [1234],
      environment: ['staging'],
    });

    const location = {
      query: {
        start: '',
        end: '',
        utc: 'true',
        // invalid statsPeriod string
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      utc: 'true',
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });

    const location2 = {
      query: {
        start: '',
        end: '',
        utc: 'true',
        // statsPeriod is omitted here
        cursor: 'some cursor',
      },
    };

    expect(eventView.getEventsAPIPayload(location2)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      utc: 'true',
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes default coerced statsPeriod when either start or end is only provided', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      query: 'event.type:csp',
      project: [1234],
      environment: ['staging'],
    });

    const location = {
      query: {
        start: '',
        utc: 'true',
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      utc: 'true',
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });

    const location2 = {
      query: {
        end: '',
        utc: 'true',
        statsPeriod: 'invalid',
        cursor: 'some cursor',
      },
    };

    expect(eventView.getEventsAPIPayload(location2)).toEqual({
      project: ['1234'],
      environment: ['staging'],
      utc: 'true',
      statsPeriod: '14d',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });

  it('includes start and end', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['count']),
      query: 'event.type:csp',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      environment: [],
      project: [],
    });

    const location = {
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '55d',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      field: ['title', 'count()'],
      sort: '-count',
      query: 'event.type:csp',
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
      per_page: 50,
      project: [],
      environment: [],
    });
  });

  it("an eventview's date selection has higher precedence than the date selection in the query string", function () {
    const initialState = {
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['count']),
      query: 'event.type:csp',
      environment: [],
      project: [],
    };

    const output = {
      field: ['title', 'count()'],
      sort: '-count',
      query: 'event.type:csp',
      per_page: 50,
      project: [],
      environment: [],
    };

    // eventview's statsPeriod has highest precedence

    let eventView = new EventView({
      ...initialState,
      statsPeriod: '90d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    let location = {
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '90d',
    });

    // eventview's start/end has higher precedence than the date selection in the query string

    eventView = new EventView({
      ...initialState,
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    location = {
      query: {
        // these should not be part of the API payload
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      start: '2019-10-01T00:00:00.000',
      end: '2019-10-02T00:00:00.000',
    });

    // the date selection in the query string should be applied as expected

    eventView = new EventView(initialState);

    location = {
      query: {
        statsPeriod: '55d',
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '55d',
    });

    location = {
      query: {
        period: '30d',
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      statsPeriod: '30d',
    });

    location = {
      query: {
        start: '2020-10-01T00:00:00',
        end: '2020-10-02T00:00:00',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      ...output,
      start: '2020-10-01T00:00:00.000',
      end: '2020-10-02T00:00:00.000',
    });
  });
});

describe('EventView.getFacetsAPIPayload()', function () {
  it('only includes relevant query strings', function () {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      query: 'event.type:csp',
    });

    const location = {
      query: {
        start: '',
        end: '',
        utc: 'true',
        statsPeriod: '14d',

        // irrelevant query strings
        bestCountry: 'canada',
        cursor: 'some cursor',
        sort: 'the world',
        project: '1234',
        environment: ['staging'],
        display: 'releases',
      },
    };

    expect(eventView.getFacetsAPIPayload(location)).toEqual({
      project: [],
      environment: [],
      utc: 'true',
      statsPeriod: '14d',

      query: 'event.type:csp',
    });
  });
});

describe('EventView.toNewQuery()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 123},
      {field: 'project.id', width: 456},
    ],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'releases',
  };

  it('outputs the right fields', function () {
    const eventView = new EventView(state);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'project.id'],
      widths: ['123', '456'],
      orderby: '-count',
      query: 'event.type:error',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is an empty string', function () {
    const modifiedState = {
      ...state,
    };

    modifiedState.query = '';

    const eventView = new EventView(modifiedState);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'project.id'],
      widths: ['123', '456'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is not defined', function () {
    const modifiedState = {
      ...state,
    };

    delete modifiedState.query;

    const eventView = new EventView(modifiedState);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fields: ['count()', 'project.id'],
      widths: ['123', '456'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
      display: 'releases',
    };

    expect(output).toEqual(expected);
  });
});

describe('EventView.isValid()', function () {
  it('event view is valid when there is at least one field', function () {
    const eventView = new EventView({
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(true);
  });

  it('event view is not valid when there are no fields', function () {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(false);
  });
});

describe('EventView.getFields()', function () {
  it('returns fields', function () {
    const eventView = new EventView({
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: [],
      project: [],
    });

    expect(eventView.getFields()).toEqual(['count()', 'project.id']);
  });
});

describe('EventView.numOfColumns()', function () {
  it('returns correct number of columns', function () {
    // has columns

    const eventView = new EventView({
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: [],
      project: [],
    });

    expect(eventView.numOfColumns()).toBe(2);

    // has no columns

    const eventView2 = new EventView({
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView2.numOfColumns()).toBe(0);
  });
});

describe('EventView.getDays()', function () {
  it('returns the right number of days for statsPeriod', function () {
    const eventView = new EventView({
      statsPeriod: '14d',
    });

    expect(eventView.getDays()).toBe(14);

    const eventView2 = new EventView({
      statsPeriod: '12h',
    });

    expect(eventView2.getDays()).toBe(0.5);
  });

  it('returns the right number of days for start/end', function () {
    const eventView = new EventView({
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
    });

    expect(eventView.getDays()).toBe(1);

    const eventView2 = new EventView({
      start: '2019-10-01T00:00:00',
      end: '2019-10-15T00:00:00',
    });
    expect(eventView2.getDays()).toBe(14);
  });
});

describe('EventView.clone()', function () {
  it('returns a unique instance', function () {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: generateSorts(['count']),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      interval: '5m',
      display: 'releases',
    };

    const eventView = new EventView(state);

    const eventView2 = eventView.clone();

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);
    expect(eventView2).toMatchObject(state);
    expect(eventView.isEqualTo(eventView2)).toBe(true);
  });
});

describe('EventView.withColumns()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 30},
      {field: 'project.id', width: 99},
    ],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const eventView = new EventView(state);

  it('adds new columns, and replaces existing ones', function () {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'title'},
      {kind: 'function', function: ['count', '']},
      {kind: 'field', field: 'project.id'},
      {kind: 'field', field: 'culprit'},
    ]);
    // Views should be different.
    expect(newView.isEqualTo(eventView)).toBe(false);
    expect(newView.fields).toEqual([
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
      {field: 'project.id', width: COL_WIDTH_UNDEFINED},
      {field: 'culprit', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('drops empty columns', function () {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'issue'},
      {kind: 'function', function: ['count', '']},
      {kind: 'field', field: ''},
      {kind: 'function', function: ['', '']},
      {kind: 'function', function: ['', '', undefined]},
    ]);
    expect(newView.fields).toEqual([
      {field: 'issue', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('inherits widths from existing columns when names match', function () {
    const newView = eventView.withColumns([
      {kind: 'function', function: ['count', '']},
      {kind: 'field', field: 'project.id'},
      {kind: 'field', field: 'title'},
      {kind: 'field', field: 'time'},
    ]);

    expect(newView.fields).toEqual([
      {field: 'count()', width: 30},
      {field: 'project.id', width: 99},
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'time', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  it('retains sorts when sorted field is included', function () {
    const newView = eventView.withColumns([
      {kind: 'field', field: 'title'},
      {kind: 'function', function: ['count', '']},
    ]);
    expect(newView.fields).toEqual([
      {field: 'title', width: COL_WIDTH_UNDEFINED},
      {field: 'count()', width: COL_WIDTH_UNDEFINED},
    ]);
    expect(newView.sorts).toEqual([{field: 'count', kind: 'desc'}]);
  });

  it('updates sorts when sorted field is removed', function () {
    const newView = eventView.withColumns([{kind: 'field', field: 'title'}]);
    expect(newView.fields).toEqual([{field: 'title', width: COL_WIDTH_UNDEFINED}]);
    // Should pick a sortable field.
    expect(newView.sorts).toEqual([{field: 'title', kind: 'desc'}]);
  });

  it('has no sort if no sortable fields remain', function () {
    const newView = eventView.withColumns([{kind: 'field', field: 'issue'}]);
    expect(newView.fields).toEqual([{field: 'issue', width: COL_WIDTH_UNDEFINED}]);
    expect(newView.sorts).toEqual([]);
  });
});

describe('EventView.withNewColumn()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', width: 30},
      {field: 'project.id', width: 99},
    ],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('adds a field', function () {
    const eventView = new EventView(state);
    const newColumn = {
      kind: 'field',
      field: 'title',
    };
    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'title'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('adds an aggregate function with no arguments', function () {
    const eventView = new EventView(state);
    const newColumn = {
      kind: 'function',
      function: ['count', ''],
    };

    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'count()'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with field', function () {
    const eventView = new EventView(state);
    const newColumn = {
      kind: 'function',
      function: ['avg', 'transaction.duration'],
    };
    const eventView2 = eventView.withNewColumn(newColumn);
    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'avg(transaction.duration)'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with field & refinement', function () {
    const eventView = new EventView(state);
    const newColumn = {
      kind: 'function',
      function: ['percentile', 'transaction.duration', '0.5'],
    };
    const updated = eventView.withNewColumn(newColumn);
    expect(updated.fields).toEqual([
      ...state.fields,
      {field: 'percentile(transaction.duration,0.5)', width: COL_WIDTH_UNDEFINED},
    ]);
  });
});

describe('EventView.withResizedColumn()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const view = new EventView(state);

  it('updates a column that exists', function () {
    const newView = view.withResizedColumn(0, 99);
    expect(view.fields[0].width).toBeUndefined();
    expect(newView.fields[0].width).toEqual(99);
  });

  it('ignores columns that do not exist', function () {
    const newView = view.withResizedColumn(100, 99);
    expect(view.fields).toEqual(newView.fields);
  });
});

describe('EventView.withUpdatedColumn()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
    title: 'string',
  };

  it('update a column with no changes', function () {
    const eventView = new EventView(state);

    const newColumn = {
      kind: 'function',
      function: ['count', ''],
    };

    const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);
  });

  it('update a column to a field', function () {
    const eventView = new EventView(state);

    const newColumn = {
      kind: 'field',
      field: 'title',
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'title'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with no arguments', function () {
    const eventView = new EventView(state);

    const newColumn = {
      kind: 'function',
      function: ['count', ''],
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'count()'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with field', function () {
    const eventView = new EventView(state);

    const newColumn = {
      kind: 'function',
      function: ['avg', 'transaction.duration'],
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'avg(transaction.duration)'}],
    };
    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with field & refinement', function () {
    const eventView = new EventView(state);

    const newColumn = {
      kind: 'function',
      function: ['percentile', 'transaction.duration', '0.5'],
    };

    const newView = eventView.withUpdatedColumn(1, newColumn, meta);
    expect(newView.fields).toEqual([
      state.fields[0],
      {field: 'percentile(transaction.duration,0.5)', width: COL_WIDTH_UNDEFINED},
    ]);
  });

  describe('update a column that is sorted', function () {
    it('the sorted column is the only sorted column', function () {
      const eventView = new EventView(state);

      const newColumn = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(state);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'title'}, state.fields[1]],
      };
      expect(eventView2).toMatchObject(nextState);
    });

    it('the sorted column occurs at least twice', function () {
      const modifiedState = {
        ...state,
        fields: [...state.fields, {field: 'count()'}],
      };

      const eventView = new EventView(modifiedState);

      const newColumn = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        fields: [{field: 'title'}, state.fields[1], {field: 'count()'}],
      };
      expect(eventView2).toMatchObject(nextState);
    });

    it('using no provided table meta', function () {
      // table meta may not be provided in the invalid query state;
      // we will still want to be able to update columns

      const eventView = new EventView(state);

      const expected = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'title'}, state.fields[1]],
      };

      const newColumn = {
        kind: 'field',
        field: 'title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, {});
      expect(eventView2).toMatchObject(expected);

      const eventView3 = eventView.withUpdatedColumn(0, newColumn);
      expect(eventView3).toMatchObject(expected);

      const eventView4 = eventView.withUpdatedColumn(0, newColumn, null);
      expect(eventView4).toMatchObject(expected);
    });
  });

  describe('update a column to a non-sortable column', function () {
    it('default to a sortable column', function () {
      const modifiedState = {
        ...state,
        fields: [{field: 'count()'}, {field: 'title'}],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn = {
        kind: 'field',
        field: 'project.id',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'project.id'}, {field: 'title'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('has no sort if there are no sortable columns', function () {
      const modifiedState = {
        ...state,
        fields: [{field: 'count()'}],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn = {
        kind: 'field',
        field: 'project.id',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [],
        fields: [{field: 'project.id'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });
  });
});

describe('EventView.withDeletedColumn()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
    title: 'string',
  };

  it('returns itself when attempting to delete the last remaining column', function () {
    const modifiedState = {
      ...state,
      fields: [{field: 'count()'}],
    };

    const eventView = new EventView(modifiedState);

    const eventView2 = eventView.withDeletedColumn(0, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(modifiedState);
  });

  describe('deletes column, and use any remaining sortable column', function () {
    it('using no provided table meta', function () {
      // table meta may not be provided in the invalid query state;
      // we will still want to be able to delete columns

      const state2 = {
        ...state,
        fields: [{field: 'title'}, {field: 'timestamp'}, {field: 'count()'}],
        sorts: generateSorts(['timestamp']),
      };

      const eventView = new EventView(state2);

      const expected = {
        ...state,
        sorts: generateSorts(['title']),
        fields: [{field: 'title'}, {field: 'count()'}],
      };

      const eventView2 = eventView.withDeletedColumn(1, {});
      expect(eventView2).toMatchObject(expected);

      const eventView3 = eventView.withDeletedColumn(1);
      expect(eventView3).toMatchObject(expected);

      const eventView4 = eventView.withDeletedColumn(1, null);
      expect(eventView4).toMatchObject(expected);
    });

    it('has no remaining sortable column', function () {
      const eventView = new EventView(state);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(state);

      const nextState = {
        ...state,
        // we expect sorts to be empty since project.id is non-sortable
        sorts: [],
        fields: [state.fields[1]],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('has a remaining sortable column', function () {
      const modifiedState = {
        ...state,
        fields: [{field: 'count()'}, {field: 'project.id'}, {field: 'title'}],
      };

      const eventView = new EventView(modifiedState);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'project.id'}, {field: 'title'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('sorted column occurs at least twice', function () {
      const modifiedState = {
        ...state,
        fields: [...state.fields, state.fields[0]],
      };

      const eventView = new EventView(modifiedState);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        fields: [state.fields[1], state.fields[0]],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('ensures there is at one auto-width column on deletion', function () {
      const modifiedState = {
        ...state,
        fields: [
          {field: 'id', width: 75},
          {field: 'title', width: 100},
          {field: 'project', width: 80},
          {field: 'environment', width: 99},
        ],
      };

      const eventView = new EventView(modifiedState);
      let updated = eventView.withDeletedColumn(0, meta);
      let updatedFields = [
        {field: 'title', width: -1},
        {field: 'project', width: 80},
        {field: 'environment', width: 99},
      ];
      expect(updated.fields).toEqual(updatedFields);

      updated = updated.withDeletedColumn(0, meta);
      updatedFields = [
        {field: 'project', width: -1},
        {field: 'environment', width: 99},
      ];
      expect(updated.fields).toEqual(updatedFields);
    });
  });
});

describe('EventView.getSorts()', function () {
  it('returns fields', function () {
    const eventView = new EventView({
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: generateSorts(['count']),
      project: [],
    });

    expect(eventView.getSorts()).toEqual([
      {
        key: 'count',
        order: 'desc',
      },
    ]);
  });
});

describe('EventView.getQuery()', function () {
  it('with query', function () {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      project: [],
      query: 'event.type:error',
    });

    expect(eventView.getQuery()).toEqual('event.type:error');
    expect(eventView.getQuery(null)).toEqual('event.type:error');
    expect(eventView.getQuery('hello')).toEqual('event.type:error hello');
    expect(eventView.getQuery(['event.type:error', 'hello'])).toEqual(
      'event.type:error hello'
    );
  });

  it('without query', function () {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      project: [],
    });

    expect(eventView.getQuery()).toEqual('');
    expect(eventView.getQuery(null)).toEqual('');
    expect(eventView.getQuery('hello')).toEqual('hello');
    expect(eventView.getQuery(['event.type:error', 'hello'])).toEqual(
      'event.type:error hello'
    );
  });
});

describe('EventView.sortForField()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };
  const eventView = new EventView(state);
  const meta = {count: 'integer'};

  it('returns the sort when selected field is sorted', function () {
    const field = {
      field: 'count()',
    };

    const actual = eventView.sortForField(field, meta);

    expect(actual).toEqual({
      field: 'count',
      kind: 'desc',
    });
  });

  it('returns undefined when selected field is not sorted', function () {
    const field = {
      field: 'project.id',
    };

    expect(eventView.sortForField(field, meta)).toBeUndefined();
  });

  it('returns undefined when no meta is provided', function () {
    const field = {
      field: 'project.id',
    };

    expect(eventView.sortForField(field, undefined)).toBeUndefined();
  });
});

describe('EventView.sortOnField()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {count: 'integer', title: 'string'};

  it('returns itself when attempting to sort on un-sortable field', function () {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[1];

    const eventView2 = eventView.sortOnField(field, meta);
    expect(eventView2 === eventView).toBe(true);
  });

  it('reverses the sorted field', function () {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[0];

    const eventView2 = eventView.sortOnField(field, meta);

    expect(eventView2 !== eventView).toBe(true);

    const nextState = {
      ...state,
      sorts: [{field: 'count', kind: 'asc'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('enforce sort order on sorted field', function () {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[0];

    const eventView2 = eventView.sortOnField(field, meta, 'asc');
    expect(eventView2).toMatchObject({
      ...state,
      sorts: [{field: 'count', kind: 'asc'}],
    });

    const eventView3 = eventView.sortOnField(field, meta, 'desc');
    expect(eventView3).toMatchObject({
      ...state,
      sorts: [{field: 'count', kind: 'desc'}],
    });
  });

  it('sort on new field', function () {
    const modifiedState = {
      ...state,
      fields: [...state.fields, {field: 'title'}],
    };

    const eventView = new EventView(modifiedState);
    expect(eventView).toMatchObject(modifiedState);

    const field = modifiedState.fields[2];

    const eventView2 = eventView.sortOnField(field, meta);

    expect(eventView2 !== eventView).toBe(true);

    const nextState = {
      ...modifiedState,
      sorts: [{field: 'title', kind: 'desc'}],
    };

    expect(eventView2).toMatchObject(nextState);

    // enforce asc sort order

    const eventView3 = eventView.sortOnField(field, meta, 'asc');

    expect(eventView3).toMatchObject({
      ...modifiedState,
      sorts: [{field: 'title', kind: 'asc'}],
    });

    // enforce desc sort order

    const eventView4 = eventView.sortOnField(field, meta, 'desc');

    expect(eventView4).toMatchObject({
      ...modifiedState,
      sorts: [{field: 'title', kind: 'desc'}],
    });
  });
});

describe('EventView.withSorts()', function () {
  it('returns a clone', function () {
    const eventView = new EventView({
      fields: [{field: 'event.type'}],
    });
    const updated = eventView.withSorts([{kind: 'desc', field: 'event.type'}]);
    expect(updated.sorts).not.toEqual(eventView.sorts);
  });

  it('only accepts sorting on fields in the view', function () {
    const eventView = new EventView({
      fields: [{field: 'event.type'}],
    });
    const updated = eventView.withSorts([
      {kind: 'desc', field: 'event.type'},
      {kind: 'asc', field: 'unknown'},
    ]);
    expect(updated.sorts).toEqual([{kind: 'desc', field: 'event.type'}]);
  });

  it('accepts aggregate field sorts', function () {
    const eventView = new EventView({
      fields: [{field: 'p50()'}],
    });
    const updated = eventView.withSorts([
      {kind: 'desc', field: 'p50'},
      {kind: 'asc', field: 'unknown'},
    ]);
    expect(updated.sorts).toEqual([{kind: 'desc', field: 'p50'}]);
  });
});

describe('EventView.isEqualTo()', function () {
  it('should be true when equal', function () {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: generateSorts(['count']),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'fam',
      display: 'releases',
    };

    const eventView = new EventView(state);
    const eventView2 = new EventView(state);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);
    expect(eventView2).toMatchObject(state);
    expect(eventView.isEqualTo(eventView2)).toBe(true);

    // commutativity property holds
    expect(eventView2.isEqualTo(eventView)).toBe(true);
  });

  it('should be true when datetime are equal but differ in format', function () {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: generateSorts(['count']),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-20T21:02:51+0000',
      end: '2019-10-23T19:27:04+0000',
      environment: ['staging'],
    };

    const eventView = new EventView(state);
    const eventView2 = new EventView({
      ...state,
      start: '2019-10-20T21:02:51Z',
      end: '2019-10-23T19:27:04Z',
    });

    expect(eventView.isEqualTo(eventView2)).toBe(true);
  });

  it('should be false when not equal', function () {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [{field: 'count()'}, {field: 'project.id'}],
      sorts: generateSorts(['count']),
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
      yAxis: 'fam',
      display: 'releases',
    };

    const differences = {
      id: '12',
      name: 'new query',
      fields: [{field: 'project.id'}, {field: 'count()'}],
      sorts: [{field: 'count', kind: 'asc'}],
      query: 'event.type:transaction',
      project: [24],
      start: '2019-09-01T00:00:00',
      end: '2020-09-01T00:00:00',
      statsPeriod: '24d',
      environment: [],
      yAxis: 'ok boomer',
      display: 'previous',
    };
    const eventView = new EventView(state);

    for (const key in differences) {
      const eventView2 = new EventView({...state, [key]: differences[key]});
      expect(eventView.isEqualTo(eventView2)).toBe(false);
    }
  });
});

describe('EventView.getResultsViewUrlTarget()', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
    display: 'previous',
  };
  const organization = TestStubs.Organization();

  it('generates a URL', function () {
    const view = new EventView(state);
    const result = view.getResultsViewUrlTarget(organization.slug);
    expect(result.pathname).toEqual('/organizations/org-slug/discover/results/');
    expect(result.query.query).toEqual(state.query);
    expect(result.query.project).toEqual(state.project);
    expect(result.query.display).toEqual(state.display);
  });
});

describe('EventView.getGlobalSelection()', function () {
  it('return default global selection', function () {
    const eventView = new EventView({});

    expect(eventView.getGlobalSelection()).toMatchObject({
      projects: [],
      environments: [],
      datetime: {
        start: null,
        end: null,
        period: '',

        // event views currently do not support the utc option,
        // see comment in EventView.getGlobalSelection
        utc: true,
      },
    });
  });

  it('returns global selection query', function () {
    const state2 = {
      project: [42],
      start: 'start',
      end: 'end',
      statsPeriod: '42d',
      environment: ['prod'],
    };

    const eventView = new EventView(state2);

    expect(eventView.getGlobalSelection()).toMatchObject({
      projects: state2.project,
      environments: state2.environment,
      datetime: {
        start: state2.start,
        end: state2.end,
        period: state2.statsPeriod,

        // event views currently do not support the utc option,
        // see comment in EventView.getGlobalSelection
        utc: true,
      },
    });
  });
});

describe('EventView.getGlobalSelectionQuery()', function () {
  it('return default global selection query', function () {
    const eventView = new EventView({});

    expect(eventView.getGlobalSelectionQuery()).toMatchObject({
      project: [],
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: [],

      // event views currently do not support the utc option,
      // see comment in EventView.getGlobalSelection
      utc: 'true',
    });
  });

  it('returns global selection query', function () {
    const state2 = {
      project: [42],
      start: 'start',
      end: 'end',
      statsPeriod: '42d',
      environment: ['prod'],
    };

    const eventView = new EventView(state2);

    expect(eventView.getGlobalSelectionQuery()).toMatchObject({
      ...state2,

      // when generating the query, it converts numbers to strings
      project: ['42'],

      // event views currently do not support the utc option,
      // see comment in EventView.getGlobalSelection
      utc: 'true',
    });
  });
});

describe('EventView.generateBlankQueryStringObject()', function () {
  it('should return blank values', function () {
    const eventView = new EventView({});

    expect(eventView.generateBlankQueryStringObject()).toEqual({
      id: undefined,
      name: undefined,
      fields: undefined,
      sorts: undefined,
      query: undefined,
      project: undefined,
      start: undefined,
      end: undefined,
      statsPeriod: undefined,
      environment: undefined,
      yAxis: undefined,
      cursor: undefined,
    });
  });
});

describe('EventView.getYAxisOptions()', function () {
  const state = {
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  function generateYaxis(value) {
    return {
      value,
      label: value,
    };
  }

  it('should return default options', function () {
    const thisEventView = new EventView(state);

    expect(thisEventView.getYAxisOptions()).toEqual(CHART_AXIS_OPTIONS);
  });

  it('should add aggregate fields as options', function () {
    let thisEventView = new EventView({
      ...state,
      fields: generateFields(['ignored-field', 'count_unique(issue)']),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([
      generateYaxis('count_unique(issue)'),
      ...CHART_AXIS_OPTIONS,
    ]);

    // should de-duplicate entries
    thisEventView = new EventView({
      ...state,
      fields: generateFields(['ignored-field', 'count()']),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([...CHART_AXIS_OPTIONS]);
  });

  it('should exclude yAxis options that are not useful', function () {
    const thisEventView = new EventView({
      ...state,
      fields: generateFields([
        'ignored-field',
        'count_unique(issue)',
        'last_seen()',
        'latest_event()',
      ]),
    });

    expect(thisEventView.getYAxisOptions()).toEqual([
      generateYaxis('count_unique(issue)'),
      ...CHART_AXIS_OPTIONS,
    ]);
  });
});

describe('EventView.getYAxis()', function () {
  const state = {
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should return first default yAxis', function () {
    const thisEventView = new EventView(state);

    expect(thisEventView.getYAxis()).toEqual('count()');
  });

  it('should return valid yAxis', function () {
    const thisEventView = new EventView({
      ...state,
      fields: generateFields([
        'ignored-field',
        'count_unique(user)',
        'last_seen',
        'latest_event',
      ]),
      yAxis: 'count_unique(user)',
    });

    expect(thisEventView.getYAxis()).toEqual('count_unique(user)');
  });

  it('should ignore invalid yAxis', function () {
    const invalid = [
      'last_seen',
      'latest_event',
      'count_unique(issue)', // this is not one of the selected fields
    ];

    for (const option of invalid) {
      const thisEventView = new EventView({
        ...state,
        fields: generateFields(['ignored-field', 'last_seen', 'latest_event']),
        yAxis: option,
      });

      // yAxis defaults to the first entry of the default yAxis options
      expect(thisEventView.getYAxis()).toEqual('count()');
    }
  });
});

describe('EventView.getDisplayOptions()', function () {
  const state = {
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should return default options', function () {
    const eventView = new EventView({
      ...state,
      // there needs to exist an aggregate or TOP 5 modes will be disabled
      fields: [{field: 'count()'}],
    });

    expect(eventView.getDisplayOptions()).toEqual(DISPLAY_MODE_OPTIONS);
  });

  it('should disable previous when start/end are used.', function () {
    const eventView = new EventView({
      ...state,
      end: '2020-04-13T12:13:14',
      start: '2020-04-01T12:13:14',
    });

    const options = eventView.getDisplayOptions();
    expect(options[1].value).toEqual('previous');
    expect(options[1].disabled).toBeTruthy();
  });

  it('should disable top 5 period/daily if no aggregates present', function () {
    const eventView = new EventView({
      ...state,
    });

    const options = eventView.getDisplayOptions();
    expect(options[2].value).toEqual('top5');
    expect(options[2].disabled).toBeTruthy();
    expect(options[4].value).toEqual('dailytop5');
    expect(options[4].disabled).toBeTruthy();
  });
});

describe('EventView.getDisplayMode()', function () {
  const state = {
    fields: [],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('should have default', function () {
    const eventView = new EventView({
      ...state,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('should return current mode when not disabled', function () {
    const eventView = new EventView({
      ...state,
      display: DisplayModes.DAILY,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DAILY);
  });

  it('should return default mode when disabled', function () {
    const eventView = new EventView({
      ...state,
      // the existence of start and end will disable the PREVIOUS mode
      end: '2020-04-13T12:13:14',
      start: '2020-04-01T12:13:14',
      display: DisplayModes.PREVIOUS,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 should fallback to default when disabled', function () {
    const eventView = new EventView({
      ...state,
      // the lack of an aggregate will disable the TOP5 mode
      display: DisplayModes.TOP5,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 daily should fallback to daily when disabled', function () {
    const eventView = new EventView({
      ...state,
      // the lack of an aggregate will disable the DAILYTOP5 mode
      display: DisplayModes.DAILYTOP5,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DAILY);
  });

  it('daily mode should fall back to default when disabled', function () {
    const eventView = new EventView({
      ...state,
      // the period being less than 24h will disable the DAILY mode
      statsPeriod: '1h',
      display: DisplayModes.DAILY,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });

  it('top 5 daily mode should fall back to default when daily is disabled', function () {
    const eventView = new EventView({
      ...state,
      // the period being less than 24h will disable the DAILY mode
      start: '2020-04-01T12:13:14',
      end: '2020-04-02T12:10:14',
      display: DisplayModes.TOP5DAILY,
    });
    const displayMode = eventView.getDisplayMode();
    expect(displayMode).toEqual(DisplayModes.DEFAULT);
  });
});

describe('EventView.getAggregateFields()', function () {
  const state = {
    fields: [
      {field: 'title'},
      {field: 'count()'},
      {field: 'count_unique(user)'},
      {field: 'apdex(300)'},
      {field: 'transaction'},
    ],
    sorts: [],
    query: '',
    project: [],
    statsPeriod: '42d',
    environment: [],
  };

  it('getAggregateFields() returns only aggregates', function () {
    const eventView = new EventView(state);
    const expected = [
      {field: 'count()'},
      {field: 'count_unique(user)'},
      {field: 'apdex(300)'},
    ];

    expect(eventView.getAggregateFields()).toEqual(expected);
  });
});

describe('EventView.hasAggregateField', function () {
  it('ensures an eventview has an aggregate field', function () {
    let eventView = new EventView({
      fields: [{field: 'foobar'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(eventView.hasAggregateField()).toBe(false);

    eventView = new EventView({
      fields: [{field: 'count(foo.bar.is-Enterprise_42)'}],
      sorts: [],
      query: '',
      project: [],
      environment: [],
    });

    expect(eventView.hasAggregateField()).toBe(true);
  });
});

describe('isAPIPayloadSimilar', function () {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [{field: 'count()'}, {field: 'project.id'}],
    sorts: generateSorts(['count']),
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
    title: 'string',
  };

  describe('getEventsAPIPayload', function () {
    it('is not similar when relevant query string keys are present in the Location object', function () {
      const thisEventView = new EventView(state);
      const location = {
        query: {
          project: 'project',
          environment: 'environment',
          start: 'start',
          end: 'end',
          utc: 'utc',
          statsPeriod: 'statsPeriod',
          cursor: 'cursor',
        },
      };
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherLocation = {};
      const otherAPIPayload = thisEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when irrelevant query string keys are present in the Location object', function () {
      const thisEventView = new EventView(state);
      const location = {
        query: {
          bestCountry: 'canada',
        },
      };
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherLocation = {};
      const otherAPIPayload = thisEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar on sort key sorted in opposite directions', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.sortOnField({field: 'count()'}, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a new column is added', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.clone();
      otherEventView.fields.push({field: 'title', width: COL_WIDTH_UNDEFINED});
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is updated with no changes', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        kind: 'function',
        function: ['count', ''],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is updated with a replaced field', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        kind: 'field',
        field: 'title',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a column is updated with a replaced aggregation', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        kind: 'function',
        function: ['avg', ''],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is renamed', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        kind: 'function',
        function: ['count', ''],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is deleted', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.withDeletedColumn(0, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });
  });

  describe('getFacetsAPIPayload', function () {
    it('only includes relevant parameters', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const results = thisEventView.getFacetsAPIPayload(location);
      const expected = {
        query: state.query,
        project: ['42'],
        statsPeriod: state.statsPeriod,
        environment: state.environment,
      };

      expect(results).toEqual(expected);
    });

    it('is similar on sort key sorted in opposite directions', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getFacetsAPIPayload(location);

      const newColumn = {
        kind: 'function',
        function: ['count', ''],
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getFacetsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
      expect(results).toBe(true);
    });

    it('is similar when a columns are different', function () {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getFacetsAPIPayload(location);

      const otherEventView = thisEventView.clone();
      otherEventView.fields.push({field: 'title', width: COL_WIDTH_UNDEFINED});
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getFacetsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
      expect(results).toBe(true);
    });
  });
});

describe('pickRelevantLocationQueryStrings', function () {
  it('picks relevant query strings', function () {
    const location = {
      query: {
        project: 'project',
        environment: 'environment',
        start: 'start',
        end: 'end',
        utc: 'utc',
        statsPeriod: 'statsPeriod',
        cursor: 'cursor',

        // irrelevant query strings
        bestCountry: 'canada',
      },
    };

    const actual = pickRelevantLocationQueryStrings(location);

    const expected = {
      start: 'start',
      end: 'end',
      utc: 'utc',
      statsPeriod: 'statsPeriod',
      cursor: 'cursor',
    };

    expect(actual).toEqual(expected);
  });
});
