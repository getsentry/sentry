import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import TextField from 'app/views/settings/components/forms/textField';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';

describe('FormField + model', function() {
  let model;
  let wrapper;
  const routerContext = TestStubs.routerContext();

  beforeEach(function() {
    model = new FormModel();
  });

  it('renders with Form', function() {
    wrapper = mountWithTheme(
      <Form model={model}>
        <TextField name="fieldName" />
      </Form>,
      routerContext
    );
    expect(wrapper).toSnapshot();
    expect(wrapper).toMatchSnapshot();
  });

  it('sets initial data in model', function() {
    wrapper = mountWithTheme(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('test');
  });

  it('has `defaultValue` from field', function() {
    wrapper = mountWithTheme(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('foo');
    expect(model.fields.get('fieldName')).toBe('foo');
  });

  it('does not use `defaultValue` when there is initial data', function() {
    wrapper = mountWithTheme(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('test');
    expect(model.fields.get('fieldName')).toBe('test');
  });

  it('transforms `defaultValue` from field with `setValue`', function() {
    wrapper = mountWithTheme(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" setValue={v => `${v}${v}`} />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('foofoo');
    expect(model.fields.get('fieldName')).toBe('foofoo');
  });

  it('sets field descriptor in model', function() {
    wrapper = mountWithTheme(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" required />
      </Form>,
      routerContext
    );

    expect(model.getDescriptor('fieldName', 'required')).toBe(true);
  });

  it('removes field descriptor in model on unmount', function() {
    wrapper = mountWithTheme(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" required />
      </Form>,
      routerContext
    );
    expect(model.fieldDescriptor.has('fieldName')).toBe(true);

    wrapper.unmount();
    expect(model.fieldDescriptor.has('fieldName')).toBe(false);
  });
});
