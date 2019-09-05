import EventView from 'app/views/eventsV2/eventView';

describe('EventView.fromSavedQuery()', function() {
  it('maps basic properties', function() {
    const saved = {
      name: 'best query',
      fields: ['count()', 'id'],
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

  it('encodes fields', function() {
    const eventView = new EventView({
      fields: [{field: 'id', title: 'ID'}, {field: 'title', title: 'Event'}],
      tags: [],
      sorts: [],
    });
    const query = eventView.generateQueryStringObject();
    expect(query.field).toEqual(['["id","ID"]', '["title","Event"]']);
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
});
