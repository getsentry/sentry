import EventView from 'app/views/organizationEventsV2/eventView';

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
