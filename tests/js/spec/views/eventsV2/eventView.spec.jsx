import EventView from 'app/views/eventsV2/eventView';

describe('EventView.fromSavedQuery()', function() {
  it('maps basic properties', function() {
    const saved = {
      name: 'best query',
      fields: ['count()', 'id'],
      conditions: [],
      range: '14d',
      start: '',
      end: '',
    };
    const eventView = EventView.fromSavedQuery(saved);
    expect(eventView.fields).toEqual([
      {field: 'count()', title: 'count()'},
      {field: 'id', title: 'id'},
    ]);
    expect(eventView.name).toEqual(saved.name);
    expect(eventView.range).toEqual('14d');
    expect(eventView.start).toEqual('');
    expect(eventView.end).toEqual('');
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
    expect(eventView.range).toEqual('14d');
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
      range: '',
      start: null,
      end: undefined,
    });
    const query = eventView.generateQueryStringObject();
    expect(query.range).toBeUndefined();
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
      fields: ['id'],
      sorts: [],
      tags: [],
      query: 'event.type:csp',
    });

    const location = {};

    expect(eventView.getEventsAPIPayload(location).query).toEqual('event.type:csp');
  });

  it('appends query conditions in location', function() {
    const eventView = new EventView({
      fields: ['id'],
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
      fields: ['id'],
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
