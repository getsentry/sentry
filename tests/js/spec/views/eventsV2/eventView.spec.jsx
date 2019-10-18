import EventView, {
  isAPIPayloadSimilar,
  pickRelevantLocationQueryStrings,
} from 'app/views/eventsV2/eventView';
import {AUTOLINK_FIELDS} from 'app/views/eventsV2/data';

const generateFields = fields => {
  return fields.map(field => {
    return {
      field,
      title: field,
    };
  });
};

const generateSorts = sorts => {
  return sorts.map(sortName => {
    return {
      field: sortName,
      kind: 'desc',
    };
  });
};

describe('EventView.fromLocation()', function() {
  it('maps query strings', function() {
    const location = {
      query: {
        id: '42',
        name: 'best query',
        field: ['count()', 'id'],
        fieldnames: ['events', 'projects'],
        sort: ['title', '-count'],
        tag: ['foo', 'bar'],
        query: 'event.type:transaction',
        project: [123],
        start: '2019-10-01T00:00:00',
        end: '2019-10-02T00:00:00',
        statsPeriod: '14d',
        environment: ['staging'],
      },
    };

    const eventView = EventView.fromLocation(location);

    expect(eventView).toMatchObject({
      id: '42',
      name: 'best query',
      fields: [{field: 'count()', title: 'events'}, {field: 'id', title: 'projects'}],
      sorts: generateSorts(['count']),
      tags: ['foo', 'bar'],
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
    });
  });
});

describe('EventView.fromSavedQuery()', function() {
  it('maps basic properties', function() {
    const saved = {
      id: '42',
      name: 'best query',
      fields: ['count()', 'id'],
      conditions: [['event.type', '=', 'transaction']],
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-id',
      environment: ['staging'],
    };
    const eventView = EventView.fromSavedQuery(saved);

    expect(eventView).toMatchObject({
      id: saved.id,
      name: saved.name,
      fields: [{field: 'count()', title: 'count()'}, {field: 'id', title: 'id'}],
      sorts: [{field: 'id', kind: 'desc'}],
      tags: [],
      query: 'event.type:transaction',
      project: [123],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
    });
  });

  it('maps equality conditions', function() {
    const saved = {
      fields: ['count()', 'id'],
      conditions: [['event.type', '=', 'error']],
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.query).toEqual('event.type:error');
  });

  it('maps properties from v2 saved query', function() {
    const saved = {
      name: 'best query',
      fields: ['count()', 'title'],
      fieldnames: ['volume', 'caption'],
      range: '14d',
      start: '',
      end: '',
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.fields).toEqual([
      {field: 'count()', title: 'volume'},
      {field: 'title', title: 'caption'},
    ]);
    expect(eventView.name).toEqual(saved.name);
    expect(eventView.statsPeriod).toEqual('14d');
    expect(eventView.start).toEqual('');
    expect(eventView.end).toEqual('');
  });
});

describe('EventView.generateQueryStringObject()', function() {
  it('skips empty values', function() {
    const eventView = new EventView({
      fields: generateFields(['id', 'title']),
      tags: [],
      sorts: [],
      project: [],
      environment: '',
      statsPeriod: '',
      start: null,
      end: undefined,
    });
    const query = eventView.generateQueryStringObject();
    expect(query.environment).toBeUndefined();
    expect(query.statsPeriod).toBeUndefined();
    expect(query.start).toBeUndefined();
    expect(query.end).toBeUndefined();
    expect(query.project).toBeUndefined();
  });

  it('generates query string object', function() {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: generateSorts(['count']),
      tags: ['foo', 'bar'],
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
    };

    const eventView = new EventView(state);

    const expected = {
      id: '1234',
      name: 'best query',
      field: ['count()', 'project.id'],
      fieldnames: ['events', 'project'],
      sort: ['-count'],
      tag: ['foo', 'bar'],
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
    };

    expect(eventView.generateQueryStringObject()).toEqual(expected);
  });

  it('encodes fields and fieldnames', function() {
    const eventView = new EventView({
      fields: [{field: 'id', title: 'ID'}, {field: 'title', title: 'Event'}],
      tags: [],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    expect(query.field).toEqual(['id', 'title']);
    expect(query.fieldnames).toEqual(['ID', 'Event']);
  });

  it('returns a copy of data preventing mutation', function() {
    const eventView = new EventView({
      fields: [{field: 'id', title: 'ID'}, {field: 'title', title: 'Event'}],
      tags: [],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    query.field.push('newthing');
    query.fieldnames.push('new thing');

    // Getting the query again should return the original values.
    const secondQuery = eventView.generateQueryStringObject();
    expect(secondQuery.field).toEqual(['id', 'title']);
    expect(secondQuery.fieldnames).toEqual(['ID', 'Event']);

    expect(query).not.toEqual(secondQuery);
  });
});

describe('EventView.getEventsAPIPayload()', function() {
  it('appends any additional conditions defined for view', function() {
    const eventView = new EventView({
      fields: generateFields(['id']),
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    const location = {};

    expect(eventView.getEventsAPIPayload(location).query).toEqual('event.type:csp');
  });

  it('appends query conditions in location', function() {
    const eventView = new EventView({
      fields: generateFields(['id']),
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        query: 'TypeError',
      },
    };
    expect(eventView.getEventsAPIPayload(location).query).toEqual(
      'event.type:csp TypeError'
    );
  });

  it('does not duplicate conditions', function() {
    const eventView = new EventView({
      fields: generateFields(['id']),
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        query: 'event.type:csp',
      },
    };
    expect(eventView.getEventsAPIPayload(location).query).toEqual('event.type:csp');
  });

  it('only includes at most one sort key', function() {
    const eventView = new EventView({
      fields: generateFields(['count()', 'title']),
      sorts: generateSorts(['title', 'count']),
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {},
    };

    expect(eventView.getEventsAPIPayload(location).sort).toEqual('-title');
  });

  it('only includes sort keys that are defined in fields', function() {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {},
    };

    expect(eventView.getEventsAPIPayload(location).sort).toEqual('-count');
  });

  it('only includes relevant query strings', function() {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        project: '1234',
        environment: ['staging'],
        start: 'start',
        end: 'end',
        utc: 'utc',
        statsPeriod: 'statsPeriod',
        cursor: 'some cursor',

        // non-relevant query strings
        bestCountry: 'canada',
      },
    };

    expect(eventView.getEventsAPIPayload(location)).toEqual({
      project: '1234',
      environment: ['staging'],
      start: 'start',
      end: 'end',
      utc: 'utc',
      statsPeriod: 'statsPeriod',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
      sort: '-count',
      cursor: 'some cursor',
    });
  });
});

describe('EventView.getTagsAPIPayload()', function() {
  it('only includes relevant query strings', function() {
    const eventView = new EventView({
      fields: generateFields(['title', 'count()']),
      sorts: generateSorts(['project', 'count']),
      tags: [],
      query: 'event.type:csp',
    });

    const location = {
      query: {
        project: '1234',
        environment: ['staging'],
        start: 'start',
        end: 'end',
        utc: 'utc',
        statsPeriod: 'statsPeriod',

        // non-relevant query strings
        bestCountry: 'canada',
        cursor: 'some cursor',
        sort: 'the world',
      },
    };

    expect(eventView.getTagsAPIPayload(location)).toEqual({
      project: '1234',
      environment: ['staging'],
      start: 'start',
      end: 'end',
      utc: 'utc',
      statsPeriod: 'statsPeriod',

      field: ['title', 'count()'],
      per_page: 50,
      query: 'event.type:csp',
    });
  });
});

describe('EventView.toNewQuery()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('outputs the right fields', function() {
    const eventView = new EventView(state);

    const output = eventView.toNewQuery();

    const expected = {
      version: 2,
      id: '1234',
      name: 'best query',
      fieldnames: ['events', 'project'],
      fields: ['count()', 'project.id'],
      orderby: '-count',
      query: 'event.type:error',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is an empty string', function() {
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
      fieldnames: ['events', 'project'],
      fields: ['count()', 'project.id'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
    };

    expect(output).toEqual(expected);
  });

  it('omits query when query is not defined', function() {
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
      fieldnames: ['events', 'project'],
      fields: ['count()', 'project.id'],
      orderby: '-count',
      projects: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      range: '14d',
      environment: ['staging'],
    };

    expect(output).toEqual(expected);
  });
});

describe('EventView.isValid()', function() {
  it('event view is valid when there is at least one field', function() {
    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'count'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(true);
  });

  it('event view is not valid when there are no fields', function() {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.isValid()).toBe(false);
  });
});

describe('EventView.getFieldNames()', function() {
  it('returns field names', function() {
    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.getFieldNames()).toEqual(['events', 'project']);
  });
});

describe('EventView.getFields()', function() {
  it('returns fields', function() {
    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.getFields()).toEqual(['count()', 'project.id']);
  });
});

describe('EventView.hasAutolinkField()', function() {
  it('returns false when none of the fields are auto-linkable', function() {
    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.hasAutolinkField()).toEqual(false);
  });

  it('returns true when any of the fields are auto-linkable', function() {
    for (const field of AUTOLINK_FIELDS) {
      const eventView = new EventView({
        fields: generateFields([field]),
        sorts: [],
        tags: [],
        project: [],
      });

      expect(eventView.hasAutolinkField()).toEqual(true);
    }
  });
});

describe('EventView.numOfColumns()', function() {
  it('returns correct number of columns', function() {
    // has columns

    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView.numOfColumns()).toBe(2);

    // has no columns

    const eventView2 = new EventView({
      fields: [],
      sorts: [],
      tags: [],
      project: [],
    });

    expect(eventView2.numOfColumns()).toBe(0);
  });
});

describe('EventView.clone()', function() {
  it('returns a unique instance', function() {
    const state = {
      id: '1234',
      name: 'best query',
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: generateSorts(['count']),
      tags: ['foo', 'bar'],
      query: 'event.type:error',
      project: [42],
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      statsPeriod: '14d',
      environment: ['staging'],
    };

    const eventView = new EventView(state);

    const eventView2 = eventView.clone();

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);
    expect(eventView2).toMatchObject(state);
  });
});

describe('EventView.withNewColumn()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('add a field', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: '',
      field: 'title',
      fieldname: 'event title',
    };

    const eventView2 = eventView.withNewColumn(newColumn);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'title', title: 'event title'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with no arguments', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: 'count',
      field: '',
      fieldname: 'another count column',
    };

    const eventView2 = eventView.withNewColumn(newColumn);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'count()', title: 'another count column'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('add an aggregate function with arguments', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: 'avg',
      field: 'transaction.duration',
      fieldname: 'average',
    };

    const eventView2 = eventView.withNewColumn(newColumn);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields, {field: 'avg(transaction.duration)', title: 'average'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });
});

describe('EventView.withUpdatedColumn()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
  };

  it('update a column with no changes', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: 'count',
      field: '',
      fieldname: 'events',
    };

    const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);
  });

  it('update a column to a field', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: '',
      field: 'title',
      fieldname: 'event title',
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'title', title: 'event title'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with no arguments', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: 'count',
      field: '',
      fieldname: 'counts',
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'count()', title: 'counts'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  it('update a column to an aggregate function with arguments', function() {
    const eventView = new EventView(state);

    const newColumn = {
      aggregation: 'avg',
      field: 'transaction.duration',
      fieldname: 'average',
    };

    const eventView2 = eventView.withUpdatedColumn(1, newColumn, meta);

    expect(eventView2 !== eventView).toBeTruthy();

    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [state.fields[0], {field: 'avg(transaction.duration)', title: 'average'}],
    };

    expect(eventView2).toMatchObject(nextState);
  });

  describe('update a column that is sorted', function() {
    it('the sorted column is the only sorted column', function() {
      const eventView = new EventView(state);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(state);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [{field: 'title', title: 'event title'}, state.fields[1]],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('the sorted column occurs at least twice', function() {
      const modifiedState = {
        ...state,
        fields: [...state.fields, {field: 'count()', title: 'events 2'}],
      };

      const eventView = new EventView(modifiedState);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        fields: [
          {field: 'title', title: 'event title'},
          state.fields[1],
          {field: 'count()', title: 'events 2'},
        ],
      };

      expect(eventView2).toMatchObject(nextState);
    });
  });

  describe('update a column to a non-sortable column', function() {
    it('default to a sortable column', function() {
      const modifiedState = {
        ...state,
        fields: [
          {field: 'count()', title: 'events'},
          {field: 'title', title: 'event title'},
        ],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn = {
        aggregation: '',
        field: 'project.id',
        fieldname: 'project',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [
          {field: 'project.id', title: 'project'},
          {field: 'title', title: 'event title'},
        ],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('has no sort if there are no sortable columns', function() {
      const modifiedState = {
        ...state,
        fields: [{field: 'count()', title: 'events'}],
      };

      const eventView = new EventView(modifiedState);

      // this column is expected to be non-sortable
      const newColumn = {
        aggregation: '',
        field: 'project.id',
        fieldname: 'project',
      };

      const eventView2 = eventView.withUpdatedColumn(0, newColumn, meta);

      expect(eventView2 !== eventView).toBeTruthy();

      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [],
        fields: [{field: 'project.id', title: 'project'}],
      };

      expect(eventView2).toMatchObject(nextState);
    });
  });
});

describe('EventView.withDeletedColumn()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
  };

  it('returns itself when attempting to delete the last remaining column', function() {
    const modifiedState = {
      ...state,
      fields: [{field: 'count()', title: 'events'}],
    };

    const eventView = new EventView(modifiedState);

    const eventView2 = eventView.withDeletedColumn(0, meta);

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(modifiedState);
  });

  describe('deletes column, and use any remaining sortable column', function() {
    it('has no remaining sortable column', function() {
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

    it('has a remaining sortable column', function() {
      const modifiedState = {
        ...state,
        fields: [
          {field: 'count()', title: 'events'},
          {field: 'project.id', title: 'project'},
          {field: 'title', title: 'event title'},
        ],
      };

      const eventView = new EventView(modifiedState);

      const eventView2 = eventView.withDeletedColumn(0, meta);

      expect(eventView2 !== eventView).toBeTruthy();
      expect(eventView).toMatchObject(modifiedState);

      const nextState = {
        ...state,
        sorts: [{field: 'title', kind: 'desc'}],
        fields: [
          {field: 'project.id', title: 'project'},
          {field: 'title', title: 'event title'},
        ],
      };

      expect(eventView2).toMatchObject(nextState);
    });

    it('sorted column occurs at least twice', function() {
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
  });
});

describe('EventView.withMovedColumn()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  it('returns itself when attempting to move column to the same placement', function() {
    const eventView = new EventView(state);

    const eventView2 = eventView.withMovedColumn({fromIndex: 0, toIndex: 0});

    expect(eventView2 === eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);
  });

  it('move column', function() {
    const eventView = new EventView(state);

    const eventView2 = eventView.withMovedColumn({fromIndex: 0, toIndex: 1});

    expect(eventView2 !== eventView).toBeTruthy();
    expect(eventView).toMatchObject(state);

    const nextState = {
      ...state,
      fields: [...state.fields].reverse(),
    };

    expect(eventView2).toMatchObject(nextState);
  });
});

describe('EventView.getSorts()', function() {
  it('returns fields', function() {
    const eventView = new EventView({
      fields: [
        {field: 'count()', title: 'events'},
        {field: 'project.id', title: 'project'},
      ],
      sorts: generateSorts(['count']),
      tags: [],
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

describe('EventView.getQuery()', function() {
  it('with query', function() {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      tags: [],
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

  it('without query', function() {
    const eventView = new EventView({
      fields: [],
      sorts: [],
      tags: [],
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

describe('EventView.isFieldSorted()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {count: 'integer'};

  it('returns the sort when selected field is sorted', function() {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = {
      field: 'count()',
      title: 'events',
    };

    const actual = eventView.isFieldSorted(field, meta);

    expect(actual).toEqual({
      field: 'count',
      kind: 'desc',
    });
  });

  it('returns undefined when selected field is not sorted', function() {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = {
      field: 'project.id',
      title: 'project',
    };

    expect(eventView.isFieldSorted(field, meta)).toBe(void 0);
  });
});

describe('EventView.sortOnField()', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {count: 'integer'};

  it('returns itself when attempting to sort on un-sortable field', function() {
    const eventView = new EventView(state);
    expect(eventView).toMatchObject(state);

    const field = state.fields[1];

    const eventView2 = eventView.sortOnField(field, meta);

    expect(eventView2 === eventView).toBe(true);
  });

  it('reverses the sorted field', function() {
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

  it('sort on new field', function() {
    const modifiedState = {
      ...state,
      fields: [...state.fields, {field: 'title', title: 'event title'}],
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
  });
});

describe('isAPIPayloadSimilar', function() {
  const state = {
    id: '1234',
    name: 'best query',
    fields: [
      {field: 'count()', title: 'events'},
      {field: 'project.id', title: 'project'},
    ],
    sorts: generateSorts(['count']),
    tags: ['foo', 'bar'],
    query: 'event.type:error',
    project: [42],
    start: '2019-10-01T00:00:00',
    end: '2019-10-02T00:00:00',
    statsPeriod: '14d',
    environment: ['staging'],
  };

  const meta = {
    count: 'integer',
  };

  describe('getEventsAPIPayload', function() {
    it('is not similar when relevant query string keys are present in the Location object', function() {
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

    it('is similar when irrelevant query string keys are present in the Location object', function() {
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

    it('is not similar on sort key sorted in opposite directions', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.sortOnField(
        {field: 'count()', title: 'events'},
        meta
      );
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a new column is added', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const otherEventView = thisEventView.withNewColumn(newColumn);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is updated with no changes', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        aggregation: 'count',
        field: '',
        fieldname: 'events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is updated with a replaced field', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a column is updated with a replaced aggregation', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        aggregation: 'avg',
        field: '',
        fieldname: 'events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is renamed', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const newColumn = {
        aggregation: 'count',
        field: '',
        fieldname: 'my events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is deleted', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.withDeletedColumn(0, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is moved', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getEventsAPIPayload(location);

      const otherEventView = thisEventView.withMovedColumn({fromIndex: 0, toIndex: 1});
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getEventsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });
  });

  describe('getTagsAPIPayload', function() {
    it('is similar on sort key sorted in opposite directions', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const otherEventView = thisEventView.sortOnField(
        {field: 'count()', title: 'events'},
        meta
      );
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a new column is added', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const otherEventView = thisEventView.withNewColumn(newColumn);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is updated with no changes', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const newColumn = {
        aggregation: 'count',
        field: '',
        fieldname: 'events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is updated with a replaced field', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const newColumn = {
        aggregation: '',
        field: 'title',
        fieldname: 'event title',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is not similar when a column is updated with a replaced aggregation', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const newColumn = {
        aggregation: 'avg',
        field: '',
        fieldname: 'events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is renamed', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const newColumn = {
        aggregation: 'count',
        field: '',
        fieldname: 'my events',
      };

      const otherEventView = thisEventView.withUpdatedColumn(0, newColumn, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });

    it('is not similar when a column is deleted', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const otherEventView = thisEventView.withDeletedColumn(0, meta);
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(false);
    });

    it('is similar when a column is moved', function() {
      const thisEventView = new EventView(state);
      const location = {};
      const thisAPIPayload = thisEventView.getTagsAPIPayload(location);

      const otherEventView = thisEventView.withMovedColumn({fromIndex: 0, toIndex: 1});
      const otherLocation = {};
      const otherAPIPayload = otherEventView.getTagsAPIPayload(otherLocation);

      const results = isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);

      expect(results).toBe(true);
    });
  });
});

describe('pickRelevantLocationQueryStrings', function() {
  it('picks relevant query strings', function() {
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
      project: 'project',
      environment: 'environment',
      start: 'start',
      end: 'end',
      utc: 'utc',
      statsPeriod: 'statsPeriod',
      cursor: 'cursor',
    };

    expect(actual).toEqual(expected);
  });
});
