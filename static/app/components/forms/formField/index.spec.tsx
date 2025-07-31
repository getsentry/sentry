import {Fragment, useState} from 'react';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

describe('FormField + model', function () {
  let model!: FormModel;

  beforeEach(function () {
    model = new FormModel();
  });

  it('renders with Form', function () {
    render(
      <Form model={model}>
        <TextField name="fieldName" />
      </Form>
    );
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

  it('preserves current value when softRemove field is unmounted and remounted', async function () {
    const initialData = {
      firstName: 'first',
      lastName: 'last',
    };

    function TestComponent() {
      const [showFields, setShowFields] = useState(true);

      return (
        <Form model={model} initialData={{...initialData}}>
          <button type="button" onClick={() => setShowFields(!showFields)}>
            Toggle Fields
          </button>
          {showFields && (
            <Fragment>
              <TextField aria-label="First Name" name="firstName" preserveOnUnmount />
              <TextField aria-label="Last Name" name="lastName" preserveOnUnmount />
            </Fragment>
          )}
        </Form>
      );
    }

    render(<TestComponent />);

    // User modifies the field values
    await userEvent.type(screen.getByRole('textbox', {name: 'First Name'}), '1');
    await userEvent.type(screen.getByRole('textbox', {name: 'Last Name'}), 'abc');

    expect(model.fields.get('firstName')).toBe(`${initialData.firstName}1`);
    expect(model.fields.get('lastName')).toBe(`${initialData.lastName}abc`);

    // Hide fields (unmount with preserveOnUnmount)
    await userEvent.click(screen.getByRole('button', {name: 'Toggle Fields'}));
    expect(screen.queryByRole('textbox', {name: 'First Name'})).not.toBeInTheDocument();

    // Fields values preserved, descriptors removed
    expect(model.fields.get('firstName')).toBe(`${initialData.firstName}1`);
    expect(model.fields.get('lastName')).toBe(`${initialData.lastName}abc`);
    expect(model.fieldDescriptor.has('firstName')).toBe(false);
    expect(model.fieldDescriptor.has('lastName')).toBe(false);

    // initialData is preserved in model
    expect(model.initialData.firstName).toBe(initialData.firstName);
    expect(model.initialData.lastName).toBe(initialData.lastName);

    // Show fields again (remount)
    await userEvent.click(screen.getByRole('button', {name: 'Toggle Fields'}));

    // Fields should be re-registered with preserved values
    expect(model.fieldDescriptor.has('firstName')).toBe(true);
    expect(model.fieldDescriptor.has('lastName')).toBe(true);
    expect(model.fields.get('firstName')).toBe(`${initialData.firstName}1`);
    expect(model.fields.get('lastName')).toBe(`${initialData.lastName}abc`);

    // initialData should still be preserved
    expect(model.initialData.firstName).toBe(initialData.firstName);
    expect(model.initialData.lastName).toBe(initialData.lastName);
  });
});
