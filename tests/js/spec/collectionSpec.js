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
  });
});
