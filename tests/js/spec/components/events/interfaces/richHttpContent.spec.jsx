import React from 'react';
import {mount, shallow} from 'enzyme';

import RichHttpContent from 'app/components/events/interfaces/richHttpContent';

describe('RichHttpContent', function() {
  let sandbox;
  let data;
  let elem;

  beforeEach(function() {
    data = {
      query: '',
      data: '',
      headers: [],
      cookies: [],
      env: {},
    };
    elem = shallow(<RichHttpContent data={data} />).instance();
    sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    sandbox.restore();
  });

  describe('getBodySection', function() {
    it('should return plain-text when given unrecognized inferred Content-Type', function() {
      let out = elem.getBodySection({
        inferredContentType: null, // no inferred content type
        data: 'helloworld',
      });

      expect(out.type).toEqual('pre');
    });

    it('should return a KeyValueList element when inferred Content-Type is x-www-form-urlencoded', function() {
      let out = elem.getBodySection({
        inferredContentType: 'application/x-www-form-urlencoded',
        data: {foo: ['bar'], bar: ['baz']},
      });

      // NOTE: displayName is set manually in this class
      expect(out.type.displayName).toEqual('KeyValueList');
      expect(out.props.data).toEqual([['bar', 'baz'], ['foo', 'bar']]);
    });

    it('should return a ContextData element when inferred Content-Type is application/json', function() {
      let out = elem.getBodySection({
        inferredContentType: 'application/json',
        data: {foo: 'bar'},
      });

      // NOTE: displayName is set manually in this class
      expect(out.type.displayName).toEqual('ContextData');
      expect(out.props.data).toEqual({
        foo: 'bar',
      });
    });

    it('should not blow up in a malformed uri', function() {
      // > decodeURIComponent('a%AFc')
      // URIError: URI malformed
      data = {
        query: 'a%AFc',
        data: '',
        headers: [],
        cookies: [],
        env: {},
      };
      expect(() => shallow(<RichHttpContent data={data} />)).not.toThrow(URIError);
    });

    it("should not cause an invariant violation if data.data isn't a string", function() {
      data = {
        query: '',
        data: [{foo: 'bar', baz: 1}],
        headers: [],
        cookies: [],
        env: {},
      };

      expect(() => mount(<RichHttpContent data={data} />)).not.toThrow();
    });
  });
});
