import React from 'react';
import {mount} from 'enzyme';

import TextField from 'app/views/settings/components/forms/textField';
import Form from 'app/views/settings/components/forms/form';
import FormModel from 'app/views/settings/components/forms/model';

describe('FormField + model', function() {
  let model;
  let wrapper;
  let routerContext = TestStubs.routerContext();

  beforeEach(function() {
    model = new FormModel();
  });

  it('renders with Form', function() {
    wrapper = mount(
      <Form model={model}>
        <TextField name="fieldName" />
      </Form>,
      routerContext
    );
    expect(wrapper).toMatchSnapshot();
  });

  it('sets initial data in model', function() {
    wrapper = mount(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('test');
  });

  it('has `defaultValue` from field', function() {
    wrapper = mount(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('foo');
    expect(model.fields.get('fieldName')).toBe('foo');
  });

  it('does not use `defaultValue` when there is initial data', function() {
    wrapper = mount(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('test');
    expect(model.fields.get('fieldName')).toBe('test');
  });

  it('transforms `defaultValue` from field with `setValue`', function() {
    wrapper = mount(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" setValue={v => `${v}${v}`} />
      </Form>,
      routerContext
    );

    expect(model.initialData.fieldName).toBe('foofoo');
    expect(model.fields.get('fieldName')).toBe('foofoo');
  });
});
