import EventView from 'app/views/eventsV2/eventView';

const generateFields = fields => {
  return fields.map(field => {
    return {
      field,
      title: field,
    };
  });
};

describe('EventView.fromSavedQuery()', function() {
  it('maps basic properties', function() {
    const saved = {
      id: 42,
      name: 'best query',
      fields: ['count()', 'id'],
      conditions: [['event.type', '=', 'transaction']],
      projects: [123],
      range: '14d',
      start: '2019-10-01T00:00:00',
      end: '2019-10-02T00:00:00',
      orderby: '-timestamp',
      environment: 'staging',
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.fields).toEqual([
      {field: 'count()', title: 'count()'},
      {field: 'id', title: 'id'},
    ]);
    expect(eventView.id).toEqual(saved.id);
    expect(eventView.name).toEqual(saved.name);
    expect(eventView.query).toEqual('event.type:transaction');
    expect(eventView.project).toEqual([123]);
    expect(eventView.statsPeriod).toEqual('14d');
    expect(eventView.start).toEqual('2019-10-01T00:00:00');
    expect(eventView.end).toEqual('2019-10-02T00:00:00');
    expect(eventView.sorts).toEqual([{field: 'timestamp', kind: 'desc'}]);
    expect(eventView.environment).toEqual('staging');
    expect(eventView.tags).toEqual([]);
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
      fields: ['id', 'title'],
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
});

describe('EventView.toNewQuery()', function() {
  it('outputs the right fields', function() {
    const eventView = new EventView({
      id: '2',
      name: 'best query',
      fields: [
        {field: 'count()', title: 'count'},
        {field: 'project.id', title: 'project'},
      ],
      query: 'event.type:error',
      statsPeriod: '14d',
      start: '',
      end: '',
      sorts: [{field: 'timestamp', kind: 'desc'}],
    });
    const output = eventView.toNewQuery();
    expect(output.fields).toEqual(['count()', 'project.id']);
    expect(output.fieldnames).toEqual(['count', 'project']);
    expect(output.name).toEqual(eventView.name);
    expect(output.range).toEqual('14d');
    expect(output.start).toEqual('');
    expect(output.end).toEqual('');
    expect(output.orderby).toEqual('-timestamp');
    expect(output.id).toEqual('2');
  });
});
