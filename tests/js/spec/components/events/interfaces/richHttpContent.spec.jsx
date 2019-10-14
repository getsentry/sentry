import React from 'react';
import {mount, shallow} from 'sentry-test/enzyme';

import RichHttpContent from 'app/components/events/interfaces/richHttpContent';

describe('RichHttpContent', function() {
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
  });

  afterEach(function() {});

  describe('getBodySection', function() {
    it('should return plain-text when given unrecognized inferred Content-Type', function() {
      const out = elem.getBodySection(
        {inferredContentType: null}, // no inferred content type
        'helloworld',
        null
      );

      expect(out.type).toEqual('pre');
    });

    it('should return a KeyValueList element when inferred Content-Type is x-www-form-urlencoded', function() {
      const out = elem.getBodySection(
        {inferredContentType: 'application/x-www-form-urlencoded'},
        {foo: ['bar'], bar: ['baz']},
        null
      );

      // NOTE: displayName is set manually in this class
      expect(out.type.displayName).toEqual('KeyValueList');
      expect(out.props.data).toEqual([['bar', 'baz'], ['foo', 'bar']]);
    });

    it('should return a ContextData element when inferred Content-Type is application/json', function() {
      const out = elem.getBodySection(
        {inferredContentType: 'application/json'},
        {foo: 'bar'},
        null
      );

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
