import React from 'react';
import {mount} from 'enzyme';

import DataText from 'app/components/events/meta/dataText';
import {decorateEvent} from 'app/components/events/meta/metaProxy';

describe('DataText', () => {
  let mock = jest.fn(() => null);

  const createEvent = (value, {err, rem, chunks} = {}) => {
    return decorateEvent({
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
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
      );
      expect(mock).toHaveBeenCalledWith('foo');
    });

    it('renders a number', () => {
      let obj = {
        value: 0,
      };
      mount(
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
      );
      expect(mock).toHaveBeenCalledWith(0);
    });

    it('renders a boolean', () => {
      let obj = {
        value: false,
      };
      mount(
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
      );
      expect(mock).toHaveBeenCalledWith(false);
    });

    it('ignores empty meta data', () => {
      let obj = decorateEvent({
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
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
      );
      expect(mock).toHaveBeenCalledWith('foo');
    });

    it('does not call render prop if required and value is falsy and no meta', () => {
      let obj = createEvent(null, {});

      mount(
        <DataText object={obj} prop="value" required>
          {mock}
        </DataText>
      );

      expect(mock).not.toHaveBeenCalled();
    });
  });

  describe('with meta', () => {
    it('annotates errors', () => {
      let obj = createEvent('foo', {err: ['something']});

      mount(
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
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
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
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
        <DataText object={obj} prop="value">
          {mock}
        </DataText>
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
