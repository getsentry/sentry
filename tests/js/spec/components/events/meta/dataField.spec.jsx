import React from 'react';
import {shallow} from 'enzyme';

import Annotated from 'app/components/events/meta/annotated';
import DataContext from 'app/components/events/meta/dataContext';
import DataField from 'app/components/events/meta/dataField';

jest.mock('app/components/events/meta/dataContext', () => {
  let context = null;

  return {
    Consumer({children}) {
      return children(context);
    },
    setContext(next) {
      context = next;
    },
  };
});

function expectRender(value, meta, props = {}) {
  expect.assertions(2);
  shallow(
    <DataField {...props}>
      {(v, m) => {
        expect(v).toBe(value);
        expect(m).toBe(meta);
      }}
    </DataField>
  ).dive();
}

describe('DataField', () => {
  let meta = {err: ['foo']};
  it('renders (value, null)', () => {
    DataContext.setContext(new Annotated('foo', null));
    expectRender('foo', null);
  });

  it('renders (value, empty)', () => {
    DataContext.setContext(new Annotated('foo', {'': {invalid: true}}));
    expectRender('foo', null);
  });

  it('renders (value, meta)', () => {
    DataContext.setContext(new Annotated('foo', {'': meta}));
    expectRender('foo', meta);
  });

  it('renders (null, meta)', () => {
    DataContext.setContext(new Annotated(null, {'': meta}));
    expectRender(null, meta);
  });

  it('renders (null, null) unless required', () => {
    DataContext.setContext(new Annotated(null, null));
    expectRender(null, null);
  });

  it('does not render (null, null) if required', done => {
    DataContext.setContext(new Annotated(null, null));
    shallow(<DataField required>{() => done.fail()}</DataField>).dive();
    done();
  });

  it('fetches an object field', () => {
    DataContext.setContext(new Annotated({foo: 'bar'}, {foo: {'': meta}}));
    expectRender('bar', meta, {path: 'foo'});
  });

  it('fetches an array item', () => {
    DataContext.setContext(new Annotated(['foo'], {'0': {'': meta}}));
    expectRender('foo', meta, {path: 0});
  });

  it('fetches a dotted path', () => {
    DataContext.setContext(new Annotated({foo: ['bar']}, {foo: {'0': {'': meta}}}));
    expectRender('bar', meta, {path: 'foo.0'});
  });

  it('fetches an array path', () => {
    DataContext.setContext(new Annotated({foo: ['bar']}, {foo: {'0': {'': meta}}}));
    expectRender('bar', meta, {path: ['foo', 0]});
  });
});
