import React from 'react';
import {mount} from 'enzyme';

import Annotated from 'app/components/events/meta/annotated';
import {withMeta} from 'app/components/events/meta/metaProxy';

describe('Annotated', () => {
  let mock = jest.fn(() => null);

  const createEvent = (value, {err, rem, chunks} = {}) => {
    return withMeta({
      value,
      _meta: {
        value: {
          '': {
            err: err || [],
            rem: rem || [],
            chunks: chunks || [],
          },
        },
      },
    });
  };

  beforeEach(function() {
    mock.mockClear();
  });

  describe('without meta', () => {
    it('renders a string', () => {
      let obj = {
        value: 'foo',
      };
      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );
      expect(mock).toHaveBeenCalledWith('foo');
    });

    it('renders a number', () => {
      let obj = {
        value: 0,
      };
      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );
      expect(mock).toHaveBeenCalledWith(0);
    });

    it('renders a boolean', () => {
      let obj = {
        value: false,
      };
      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );
      expect(mock).toHaveBeenCalledWith(false);
    });

    it('ignores empty meta data', () => {
      let obj = withMeta({
        value: 'foo',
        _meta: {
          value: {
            '': {
              err: [],
              rem: [],
              chunks: [],
            },
          },
        },
      });
      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );
      expect(mock).toHaveBeenCalledWith('foo');
    });

    it('does not call render prop if required and value is falsy and no meta', () => {
      let obj = createEvent(null, {});

      mount(
        <Annotated object={obj} prop="value" required>
          {mock}
        </Annotated>
      );

      expect(mock).not.toHaveBeenCalled();
    });
  });

  describe('with meta', () => {
    it('annotates errors', () => {
      let obj = createEvent('foo', {err: ['something']});

      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );

      expect(mock.mock.calls[0][0].props).toEqual(
        expect.objectContaining({
          value: 'foo',
          chunks: [],
          remarks: [],
          errors: ['something'],
        })
      );
    });

    it('annotates remarks and chunks', () => {
      let obj = createEvent('foo', {rem: [{type: 't'}], chunks: [{text: 'foo'}]});

      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );

      expect(mock.mock.calls[0][0].props).toEqual(
        expect.objectContaining({
          value: 'foo',
          remarks: [{type: 't'}],
          chunks: [{text: 'foo'}],
          errors: [],
        })
      );
    });

    it('annotates redacted text', () => {
      let obj = createEvent(null, {err: ['something']});

      mount(
        <Annotated object={obj} prop="value">
          {mock}
        </Annotated>
      );

      expect(mock.mock.calls[0][0].props).toEqual(
        expect.objectContaining({
          value: null,
          chunks: [],
          remarks: [],
          errors: ['something'],
        })
      );
    });
  });
});
