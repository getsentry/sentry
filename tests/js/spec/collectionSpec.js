describe('sentry.collection', function(){

  beforeEach(module('sentry'));

  var Collection;

  beforeEach(inject(function($injector){
    Collection = $injector.get('Collection');
  }));

  describe('push', function() {
    it('should append elements', function(){
      var c = new Collection();
      c.push({id: 'foo'});
      c.push({id: 'bar'});

      assert.equal(c.length, 2);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[1].id, 'bar');
    });

    it('should update existing elements', function(){
      var c = new Collection();
      c.push({id: 'foo', biz: 'baz'});
      c.push({id: 'foo', biz: 'boz'});

      assert.equal(c.length, 1);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[0].biz, 'boz');
    });
  });

  describe('unshift', function() {
    it('should prepend elements', function(){
      var c = new Collection();
      c.unshift({id: 'foo'});
      c.unshift({id: 'bar'});

      assert.equal(c.length, 2);

      assert.equal(c[0].id, 'bar');
      assert.equal(c[1].id, 'foo');
    });

    it('should update existing elements', function(){
      var c = new Collection();
      c.unshift({id: 'foo', biz: 'baz'});
      c.unshift({id: 'foo', biz: 'boz'});

      assert.equal(c.length, 1);

      assert.equal(c[0].id, 'foo');
      assert.equal(c[0].biz, 'boz');
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

});
