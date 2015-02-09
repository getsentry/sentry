describe('utils.Collection', function(){
  // TODO(dcramer): figure out how we make 'app' a module
  var Collection = require(__dirname + '/../../../src/sentry/static/sentry/app/utils/collection.jsx');

  describe('add', function() {
    it('should append elements', function(){
      var c = new Collection();
      c.add({id: 'foo'});
      c.add({id: 'bar'});

      assert.equal(c.length, 2);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[1].id, 'bar');
    });

    it('should update existing elements', function(){
      var c = new Collection();
      c.add({id: 'foo', biz: 'baz'});
      c.add({id: 'foo', biz: 'boz'});

      assert.equal(c.length, 1);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[0].biz, 'boz');
    });

    it('should should respect limit', function(){
      var c = new Collection([], {limit: 2});
      c.add({id: 'foo'});
      c.add({id: 'bar'});
      c.add({id: 'baz'});

      assert.equal(c.length, 2);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[1].id, 'bar');
    });

  });

  describe('remove', function() {
    it('should not fail with missing elements', function(){
      var c = new Collection();

      c.remove({id: 'foo'});
    });

    it('should remove matching element', function(){
      var c = new Collection([{id: 'foo'}, {id: 'bar'}]);

      c.remove({id: 'foo'});

      assert.equal(c.length, 1);

      assert.equal(c[0].id, 'bar');
    });
  });

  describe('empty', function() {
    it('should clear all values', function(){
      var c = new Collection([{id: 'foo'}, {id: 'bar'}]);

      c.empty();

      assert.equal(c.length, 0);
    });
  });

});
