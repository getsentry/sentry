function make_group(data) {
  data = data || {};

  return new app.Group({
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
  });
}

describe("OrderedElementsView", function() {
  var view;

  beforeEach(function() {
    view = new app.OrderedElementsView({
        id: 'foo',
        maxItems: 3
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

    it("replaces in collection", function() {
      group = make_group();
      view.addMember(group);
      view.addMember(group);
      view.addMember(group);
      expect(view.collection.length).toBe(1);
    });

    it("sorts members by score after insert", function(){
      view.addMember(make_group({id: 1, score: 3}));
      view.addMember(make_group({id: 2, score: 5}));

      expect(view.collection.models[0].get('id')).toBe(2);
      expect(view.collection.models[1].get('id')).toBe(1);
    });
  });

  describe("renderMemberInContainer", function() {
    var group1;
    var group2;
    var group3;
    var group4;

    beforeEach(function() {
      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});
      group3 = make_group({id: 3, score: 2});
      group4 = make_group({id: 4, score: 6});

      view = new app.OrderedElementsView({
          id: 'dummy',
          maxItems: 3
      });
      view.$parent = $('<ul></ul>');

      view.addMember(group1);
      view.addMember(group2);
      view.addMember(group3);
      view.addMember(group4);
    });

    it("truncated to max items", function(){
      expect(view.collection.length).toBe(3);
    });
  });
});