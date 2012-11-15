function make_group(data) {
  data = data || {};

  return {
    id: data.id || 1,
    score: data.score || 5,
    count: 1,
    permalink: 'http://example.com',
    title: 'test',
    message: 'test message',
    lastSeen: '2012-01-13T08:15:36Z',
    timeSpent: 0,
    project: 'default',
    canResolve: false,
    logger: 'root',
    versions: [],
    tags: []
  };
}

describe("OrderedElementsView", function() {
  var view;

  beforeEach(function() {
    view = new app.OrderedElementsView({
        id: 'foo'
    });
  });

  it("should bind a collection", function() {
    expect(view.collection);
  });

  describe("addMember", function() {
    it("adds to collection", function() {
      group = make_group();
      view.addMember(group);
      expect(view.collection.models[0].get('id')).toBe(group.id);
    });

    it("sorts members by score after insert", function(){
      view.addMember(make_group({id: 1, score: 3}));
      view.addMember(make_group({id: 2, score: 5}));

      expect(view.collection.models[0].get('id')).toBe(2);
      expect(view.collection.models[1].get('id')).toBe(1);
    });
  });
});