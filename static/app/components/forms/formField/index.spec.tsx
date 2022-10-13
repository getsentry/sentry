import {render} from 'sentry-test/reactTestingLibrary';

import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

describe('FormField + model', function () {
  let model;

  beforeEach(function () {
    model = new FormModel();
  });

  it('renders with Form', function () {
    const wrapper = render(
      <Form model={model}>
        <TextField name="fieldName" />
      </Form>
    );
    expect(wrapper.container).toSnapshot();
  });

  it('sets initial data in model', function () {
    render(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" />
      </Form>
    );

    expect(model.initialData.fieldName).toBe('test');
  });

  it('has `defaultValue` from field', function () {
    render(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>
    );

    expect(model.initialData.fieldName).toBe('foo');
    expect(model.fields.get('fieldName')).toBe('foo');
  });

  it('does not use `defaultValue` when there is initial data', function () {
    render(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" defaultValue="foo" />
      </Form>
    );

    expect(model.initialData.fieldName).toBe('test');
    expect(model.fields.get('fieldName')).toBe('test');
  });

  it('transforms `defaultValue` from field with `setValue`', function () {
    render(
      <Form model={model}>
        <TextField name="fieldName" defaultValue="foo" setValue={v => `${v}${v}`} />
      </Form>
    );

    expect(model.initialData.fieldName).toBe('foofoo');
    expect(model.fields.get('fieldName')).toBe('foofoo');
  });

  it('sets field descriptor in model', function () {
    render(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" required />
      </Form>
    );

    expect(model.getDescriptor('fieldName', 'required')).toBe(true);
  });

  it('removes field descriptor in model on unmount', function () {
    const wrapper = render(
      <Form model={model} initialData={{fieldName: 'test'}}>
        <TextField name="fieldName" required />
      </Form>
    );
    expect(model.fieldDescriptor.has('fieldName')).toBe(true);

    wrapper.unmount();
    expect(model.fieldDescriptor.has('fieldName')).toBe(false);
  });
});
