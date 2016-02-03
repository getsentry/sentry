import React from 'react';
import {shallow} from 'enzyme';

import RichHttpContent from 'app/components/events/interfaces/richHttpContent';

describe('RichHttpContent', function () {
  beforeEach(function () {
    this.data = {
      query: '',
      data: '',
      headers: [],
      cookies: [],
      env: {}
    };
    this.elem = shallow(<RichHttpContent data={this.data} />).instance();
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe('objectToSortedTupleArray', function () {
    it('should convert a key/value object to a sorted array of key/value tuples', function () {
      let elem = this.elem;
      expect(elem.objectToSortedTupleArray({
        awe: 'some',
        foo: 'bar',
        bar: 'baz'
      })).to.eql([
        // note sorted alphabetically by key
        ['awe', 'some'],
        ['bar', 'baz'],
        ['foo', 'bar']
      ]);

      expect(elem.objectToSortedTupleArray({
        foo: ['bar', 'baz']
      })).to.eql([
        ['foo', 'bar'], ['foo', 'baz']
      ]);

      expect(elem.objectToSortedTupleArray({
        foo: ''
      })).to.eql([
        ['foo', '']
      ]);
    });
  });

  describe('getBodySection', function () {
    it('should return plain-text when unrecognized Content-Type and not parsable as JSON', function () {
      let out = this.elem.getBodySection({
        headers: [], // no content-type header,
        data: 'helloworld'
      });

      expect(out.type).to.eql('pre');
    });

    it('should return a KeyValueList element when Content-Type is x-www-form-urlencoded', function () {
      let out = this.elem.getBodySection({
        headers: [
          ['lol' , 'no'],
          ['Content-Type', 'application/x-www-form-urlencoded']
        ], // no content-type header,
        data: 'foo=bar&bar=baz'
      });

      // NOTE: ContextData is stubbed in tests; instead returns <div className="ContextData"/>
      expect(out.type.displayName).to.eql('KeyValueList');
      expect(out.props.data).to.eql([
        ['bar', 'baz'],
        ['foo', 'bar']
      ]);
    });

    it('should return plain-text when Content-Type is x-www-form-urlencoded and query string cannot be parsed', function () {
      let out = this.elem.getBodySection({
        headers: [
          ['Content-Type', 'application/x-www-form-urlencoded']
        ],
        data: 'foo=hello%2...' // note: broken URL encoded value (%2 vs %2F)
      });

      expect(out.type).to.eql('pre');
    });

    it('should return a ContextData element when Content-Type is application/json', function () {
      let out = this.elem.getBodySection({
        headers: [
          ['lol' , 'no'],
          ['Content-Type', 'application/json']
        ], // no content-type header,
        data: JSON.stringify({foo: 'bar'})
      });

      // NOTE: ContextData is stubbed in tests; instead returns <div className="ContextData"/>
      expect(out.type.displayName).to.eql('ContextData');
      expect(out.props.data).to.eql({
        foo: 'bar'
      });
    });

    it('should return a ContextData element when content is JSON, ignoring Content-Type', function () {
      let out = this.elem.getBodySection({
        headers: [
          ['Content-Type', 'application/x-www-form-urlencoded']
        ], // no content-type header,
        data: JSON.stringify({foo: 'bar'})
      });

      // NOTE: ContextData is stubbed in tests; instead returns <div className="ContextData"/>
      expect(out.type.displayName).to.eql('ContextData');
      expect(out.props.data).to.eql({
        foo: 'bar'
      });
    });

    it('should return plain-text when JSON is not parsable', function () {
      let out = this.elem.getBodySection({
        headers: [
          ['lol' , 'no'],
          ['Content-Type', 'application/json']
        ],
        data: 'lol not json'
      });

      expect(out.type).to.eql('pre');
    });

    it('should now blow up in a malformed uri', function () {
      // > decodeURIComponent('a%AFc')
      // URIError: URI malformed
      let data = {
        query: 'a%AFc',
        data: '',
        headers: [],
        cookies: [],
        env: {}
      };
      expect(() => shallow(<RichHttpContent data={data} />)).to.not.throw(URIError);
    });
  });
});
