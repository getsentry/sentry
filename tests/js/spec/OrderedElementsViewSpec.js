function make_group(data) {
  data = data || {};

  return new app.models.Group({
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
  var group1;
  var group2;
  var group3;
  var group4;

  describe("without initial members", function() {
    beforeEach(function() {
      view = new app.OrderedElementsView({
          id: 'foo'
      });
      view.$parent = $('<ul></ul>');
    });

    it("should suggest its not loaded", function() {
      expect(view.loaded).toBe(false);
    });

    it("has status text to loading", function() {
      expect(view.$empty.html()).toBe(view.loadingMessage);
    });
  });

  describe("with initial members", function() {
    beforeEach(function() {
      group1 = make_group({id: 1, score: 3});
      view = new app.OrderedElementsView({
          id: 'foo',
          members: [group1]
      });
    });

    it("should suggest its loaded", function() {
      expect(view.loaded).toBe(true);
    });

    it("has status text to loading", function() {
      expect(view.$empty.html()).not.toBe(view.loadingMessage);
    });
  });

  describe(".reset", function() {

    describe("with data", function(){
      beforeEach(function(){
        group1 = make_group({id: 1, score: 3});
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        view.collection.reset = sinon.spy();
        view.reset([group1]);
      });

      it("calls collection.reset with data", function() {
        expect(view.collection.reset.called).toBe(true);
        expect(view.collection.reset.calledWithExactly([group1])).toBe(true);
      });

      it("suggests its loaded", function() {
        expect(view.loaded).toBe(true);
      });

      it("changes status text to empty", function() {
        expect(view.$empty.html()).toBe(view.emptyMessage);
      });
    });

    describe("with empty list of data", function(){
      beforeEach(function(){
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        group1 = make_group({id: 1, score: 3});
        view.collection.reset = sinon.spy();
        view.reset([]);
      });

      it("calls collection.reset with data", function() {
        expect(view.collection.reset.called).toBe(true);
        expect(view.collection.reset.calledWithExactly([])).toBe(true);
      });

      it("suggests its loaded", function() {
        expect(view.loaded).toBe(true);
      });

      it("changes status text to empty", function() {
        expect(view.$empty.html()).toBe(view.emptyMessage);
      });
    });

    describe("with no data value", function(){
      beforeEach(function(){
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        group1 = make_group({id: 1, score: 3});
        view.collection.reset = sinon.spy();
        view.reset();
      });

      it("calls collection.reset with no value", function() {
        expect(view.collection.reset.called).toBe(true);
        expect(view.collection.reset.calledWithExactly()).toBe(true);
      });

      it("suggests its not loaded", function() {
        expect(view.loaded).toBe(false);
      });

      it("changes status text to loading", function() {
        expect(view.$empty.html()).toBe(view.loadingMessage);
      });
    });
  });

  describe(".extend", function() {
    beforeEach(function(){
      view = new app.OrderedElementsView({
          id: 'foo'
      });
      view.addMember = sinon.spy();
    });

    it("calls addMember for each item", function() {
      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});

      view.extend([group1, group2]);
      expect(view.addMember.callCount).toBe(2);
      expect(view.addMember.calledWithExactly(group1)).toBe(true);
      expect(view.addMember.calledWithExactly(group2)).toBe(true);
    });
  });

  describe(".addMember", function() {
    beforeEach(function(){
      view = new app.OrderedElementsView({
          id: 'foo',
          maxItems: 3
      });
    });

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

    it("truncated to max items", function(){
      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});
      group3 = make_group({id: 3, score: 2});
      group4 = make_group({id: 4, score: 6});

      view.addMember(group1);
      view.addMember(group2);
      view.addMember(group3);
      view.addMember(group4);

      expect(view.collection.length).toBe(3);
    });

    it("sorts members by score after insert", function(){
      view.addMember(make_group({id: 1, score: 3}));
      view.addMember(make_group({id: 2, score: 5}));

      expect(view.collection.models[0].get('id')).toBe(2);
      expect(view.collection.models[1].get('id')).toBe(1);
    });

    it("doesnt move members that didnt re-rank", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      // change the score, but keep it in the same rank
      view.addMember(make_group({id: 2, score: 50}));

      expect(view.collection.models[0].get('id')).toBe(3);
      expect(view.collection.models[1].get('id')).toBe(2);
      expect(view.collection.models[2].get('id')).toBe(1);
    });

    it("resorts members when they change", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      // change the score so it should be at the top
      view.addMember(make_group({id: 1, score: 1000}));

      expect(view.collection.models[0].get('id')).toBe(1);
      expect(view.collection.models[1].get('id')).toBe(3);
      expect(view.collection.models[2].get('id')).toBe(2);
    });

    it("correctly handles truncating lowest score values", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      view.addMember(make_group({id: 4, score: 52}));
      view.addMember(make_group({id: 5, score: 51}));
      view.addMember(make_group({id: 2, score: 50}));

      expect(view.collection.length).toBe(3);
      expect(view.collection.models[0].get('id')).toBe(3);
      expect(view.collection.models[1].get('id')).toBe(4);
      expect(view.collection.models[2].get('id')).toBe(5);
    });

  });

  describe(".renderMemberInContainer", function() {
    beforeEach(function(){
      view = new app.OrderedElementsView({
          id: 'dummy',
          maxItems: 3
      });

      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});
      group3 = make_group({id: 3, score: 2});

      view.addMember(group1);
      view.addMember(group2);
      view.addMember(group3);
    });

    it("pushes highest scored elements to the top on change", function(){
      group3.set('score', 100);
      view.addMember(group3);
      group4 = make_group({id: 4, score: 500});
      view.addMember(group4);
      expect(view.$parent.find('li').length).toBe(view.collection.models.length);
    });


    it("has the correct number of elements", function(){
      expect(view.$parent.find('li').length).toBe(view.collection.models.length);
    });

    it("has list elements sorted correctly", function(){
      view.$parent.find('li').each(function(_, el){
        expect(this.id).toBe('dummy' + view.collection.models[_].id);
      });
    });
  });
});