import React from 'react';

import {mountWithTheme, shallow} from 'sentry-test/enzyme';

import RichHttpContent from 'app/components/events/interfaces/richHttpContent/richHttpContent';

describe('RichHttpContent', function () {
  let data;

  afterEach(function () {});

  describe('getBodySection', function () {
    it('should return plain-text when given unrecognized inferred Content-Type', function () {
      data = {
        query: '',
        data: 'helloworld',
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: null,
      };
      const wrapper = mountWithTheme(<RichHttpContent data={data} />);
      expect(
        wrapper.find('[data-test-id="rich-http-content-body-section-pre"]')
      ).toBeTruthy();
    });

    it('should return a KeyValueList element when inferred Content-Type is x-www-form-urlencoded', function () {
      data = {
        query: '',
        data: {foo: ['bar'], bar: ['baz']},
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: 'application/x-www-form-urlencoded',
      };
      const wrapper = mountWithTheme(<RichHttpContent data={data} />);
      expect(
        wrapper.find('[data-test-id="rich-http-content-body-key-value-list"]')
      ).toBeTruthy();
    });

    it('should return a ContextData element when inferred Content-Type is application/json', function () {
      data = {
        query: '',
        data: {foo: 'bar'},
        headers: [],
        cookies: [],
        env: {},
        inferredContentType: 'application/json',
      };
      const wrapper = mountWithTheme(<RichHttpContent data={data} />);
      expect(
        wrapper.find('[data-test-id="rich-http-content-body-context-data"]')
      ).toBeTruthy();
    });

    it('should not blow up in a malformed uri', function () {
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

    it("should not cause an invariant violation if data.data isn't a string", function () {
      data = {
        query: '',
        data: [{foo: 'bar', baz: 1}],
        headers: [],
        cookies: [],
        env: {},
      };

      expect(() => mountWithTheme(<RichHttpContent data={data} />)).not.toThrow();
    });
  });
});
