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
    tags: [],
    version: 0
  };
}

describe("OrderedElementsView", function() {
  var view;
  var group1;
  var group2;
  var group3;
  var group4;
  var member;
  var TestModel;

  it("maintains correct models", function() {
      TestModel = Backbone.Model.extend({
          defaults: {foo: "bar"}
      });

      view = new app.OrderedElementsView({
          id: 'foo',
          model: TestModel
      });
      view.$parent = $('<ul></ul>');

      view.addMember({
        id: 1,
        biz: "baz"
      });

      member = view.collection.get(1)
      assert.equal(member.get("biz"), "baz");
      assert.equal(member.get("foo"), "bar");
  });

  describe("without initial members", function() {
    beforeEach(function() {
      view = new app.OrderedElementsView({
          id: 'foo'
      });
      view.$parent = $('<ul></ul>');
    });

    it("should suggest its not loaded", function() {
      assert.isFalse(view.loaded);
    });

    it("has status text to loading", function() {
      assert.equal(view.$empty.html(), view.loadingMessage);
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
      assert.isTrue(view.loaded);
    });

    it("has status text to loading", function() {
      assert.notEqual(view.$empty.html(), view.loadingMessage);
    });
  });

  describe(".reset", function() {

    describe("with data", function(){
      beforeEach(function(){
        group1 = make_group({id: 1, score: 3});
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        view.collection.reset = this.sinon.spy();
        view.reset([group1]);
      });

      it("calls collection.reset with data", function() {
        assert.isTrue(view.collection.reset.calledOnce);
      });

      it("suggests its loaded", function() {
        assert.isTrue(view.loaded);
      });

      it("changes status text to empty", function() {
        assert.equal(view.$empty.html(), view.emptyMessage);
      });
    });

    describe("with empty list of data", function(){
      beforeEach(function(){
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        group1 = make_group({id: 1, score: 3});
        view.collection.reset = this.sinon.spy();
        view.reset([]);
      });

      it("calls collection.reset with data", function() {
        assert.isTrue(view.collection.reset.called);
        assert.isTrue(view.collection.reset.calledWithExactly([]));
      });

      it("suggests its loaded", function() {
        assert.isTrue(view.loaded);
      });

      it("changes status text to empty", function() {
        assert.equal(view.$empty.html(), view.emptyMessage);
      });
    });

    describe("with no data value", function(){
      beforeEach(function(){
        view = new app.OrderedElementsView({
            id: 'foo'
        });
        group1 = make_group({id: 1, score: 3});
        view.collection.reset = this.sinon.spy();
        view.reset();
      });

      it("calls collection.reset with no value", function() {
        assert.isTrue(view.collection.reset.called);
        assert.isTrue(view.collection.reset.calledWithExactly());
      });

      it("suggests its not loaded", function() {
        assert.isFalse(view.loaded);
      });

      it("changes status text to loading", function() {
        assert.equal(view.$empty.html(), view.loadingMessage);
      });
    });
  });

  describe(".extend", function() {
    beforeEach(function(){
      view = new app.OrderedElementsView({
          id: 'foo'
      });
      view.addMember = this.sinon.spy();
    });

    it("calls addMember for each item", function() {
      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});

      view.extend([group1, group2]);
      assert.equal(view.addMember.callCount, 2);
      assert.isTrue(view.addMember.calledWithExactly(group1));
      assert.isTrue(view.addMember.calledWithExactly(group2));
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
      assert.strictEqual(view.collection.models[0].get('id'), group.id);
    });

    it("replaces in collection", function() {
      group = make_group();
      view.addMember(group);
      view.addMember(group);
      view.addMember(group);
      assert.strictEqual(view.collection.length, 1);
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

      assert.strictEqual(view.collection.length, 3);
    });

    it("sorts members by score after insert", function(){
      view.addMember(make_group({id: 1, score: 3}));
      view.addMember(make_group({id: 2, score: 5}));

      assert.strictEqual(view.collection.models[0].get('id'), 2);
      assert.strictEqual(view.collection.models[1].get('id'), 1);
    });

    it("doesnt move members that didnt re-rank", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      // change the score, but keep it in the same rank
      view.addMember(make_group({id: 2, score: 50}));

      assert.strictEqual(view.collection.models[0].get('id'), 3);
      assert.strictEqual(view.collection.models[1].get('id'), 2);
      assert.strictEqual(view.collection.models[2].get('id'), 1);
    });

    it("resorts members when they change", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      // change the score so it should be at the top
      view.addMember(make_group({id: 1, score: 1000}));

      assert.strictEqual(view.collection.models[0].get('id'), 1);
      assert.strictEqual(view.collection.models[1].get('id'), 3);
      assert.strictEqual(view.collection.models[2].get('id'), 2);
    });

    it("correctly handles truncating lowest score values", function(){
      view.addMember(make_group({id: 1, score: 1}));
      view.addMember(make_group({id: 2, score: 10}));
      view.addMember(make_group({id: 3, score: 100}));
      view.addMember(make_group({id: 4, score: 52}));
      view.addMember(make_group({id: 5, score: 51}));
      view.addMember(make_group({id: 2, score: 50}));

      assert.strictEqual(view.collection.length, 3);
      assert.strictEqual(view.collection.models[0].get('id'), 3);
      assert.strictEqual(view.collection.models[1].get('id'), 4);
      assert.strictEqual(view.collection.models[2].get('id'), 5);
    });

  });

  describe(".renderMemberInContainer", function() {
    var TestView = Backbone.View.extend({
      render: function(){
        var node = $('<li></li>');
        node.attr('id', 'test-' + this.model.get('id'));
        this.$el.html(node);
      }
    });

    beforeEach(function(){
      view = new app.OrderedElementsView({
          id: 'test-',
          maxItems: 3,
          view: TestView
      });
      view.$parent = $('<ul></ul>');

      group1 = make_group({id: 1, score: 3});
      group2 = make_group({id: 2, score: 5});
      group3 = make_group({id: 3, score: 2});

      view.addMember(group1);
      view.addMember(group2);
      view.addMember(group3);
    });

    it("pushes highest scored elements to the top on change", function(){
      group3.score = 100;
      view.addMember(group3);
      group4 = make_group({id: 4, score: 500});
      view.addMember(group4);
      assert.strictEqual(view.$parent.find('li').length, view.collection.length);
    });


    it("has the correct number of elements", function(){
      assert.strictEqual(view.$parent.find('li').length, view.collection.length);
    });

    it("has list elements sorted correctly", function(){
      view.$parent.find('li').each(function(_, el){
        assert.strictEqual(this.id, 'test-' + view.collection.models[_].id);
      });
    });
  });
});
