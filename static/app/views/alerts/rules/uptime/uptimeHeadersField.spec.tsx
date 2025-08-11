import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';

import {UptimeHeadersField} from './uptimeHeadersField';

describe('UptimeHeaderField', function () {
  function input(name: string) {
    return screen.getByRole('textbox', {name});
  }

  it('can be manipulated', async function () {
    const model = new FormModel();
    render(
      <Form model={model}>
        <UptimeHeadersField name="headers" />
      </Form>
    );

    // Starts with one empty header row
    expect(input('Name of header 1')).toBeInTheDocument();
    expect(input('Value of header 1')).toBeInTheDocument();

    // Change the name of the first item
    await userEvent.type(input('Name of header 1'), 'My-Header');
    expect(model.getValue('headers')).toEqual([['My-Header', '']]);

    // Change the value of the first item
    await userEvent.type(input('Value of My-Header'), 'example');
    expect(model.getValue('headers')).toEqual([['My-Header', 'example']]);

    // Add a new header
    await userEvent.click(screen.getByRole('button', {name: 'Add Header'}));

    // New item has been added
    expect(input('Name of header 2')).toBeInTheDocument();
    expect(input('Value of header 2')).toBeInTheDocument();

    // Old items still exist
    expect(input('Name of header 1')).toBeInTheDocument();
    expect(input('Name of header 1')).toHaveValue('My-Header');
    expect(model.getValue('headers')).toEqual([['My-Header', 'example']]);

    // Setting the value of header item 2 does persist the value without a name
    await userEvent.type(input('Value of header 2'), 'whatever');
    expect(input('Value of header 2')).toHaveValue('whatever');
    expect(model.getValue('headers')).toEqual([['My-Header', 'example']]);

    // Giving header item 2 a name will persist it's value
    await userEvent.type(input('Name of header 2'), 'X-Second-Header');
    expect(model.getValue('headers')).toEqual([
      ['My-Header', 'example'],
      ['X-Second-Header', 'whatever'],
    ]);

    // Remove the first header
    await userEvent.click(screen.getByRole('button', {name: 'Remove My-Header'}));
    expect(model.getValue('headers')).toEqual([['X-Second-Header', 'whatever']]);
    expect(
      screen.queryByRole('textbox', {name: 'Vaalue of My-Header'})
    ).not.toBeInTheDocument();
  });

  it('disambiguates headers with the same name', async function () {
    const model = new FormModel();
    render(
      <Form model={model}>
        <UptimeHeadersField name="headers" />
      </Form>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Header'}));

    await userEvent.type(input('Name of header 1'), 'test');
    await userEvent.type(input('Name of header 2'), 'test');

    expect(input('Value of test')).toBeInTheDocument();
    expect(input('Value of test (2)')).toBeInTheDocument();
  });

  it('does not persist empty header names', async function () {
    const model = new FormModel();
    render(
      <Form model={model}>
        <UptimeHeadersField name="headers" />
      </Form>
    );

    await userEvent.click(screen.getByRole('button', {name: 'Add Header'}));

    await userEvent.type(input('Name of header 1'), 'test');
    await userEvent.type(input('Value of test'), 'test value');

    // The second value is dropped
    expect(model.getValue('headers')).toEqual([['test', 'test value']]);
  });

  it('populates with initial values', function () {
    const model = new FormModel({
      initialData: {
        headers: [
          ['one', 'test one'],
          ['two', 'test two'],
        ] as any,
      },
    });

    render(
      <Form model={model}>
        <UptimeHeadersField name="headers" />
      </Form>
    );

    expect(input('Name of header 1')).toHaveValue('one');
    expect(input('Name of header 2')).toHaveValue('two');
    expect(input('Value of one')).toHaveValue('test one');
    expect(input('Value of two')).toHaveValue('test two');
  });

  it('remove special characters from header names', async function () {
    const model = new FormModel();
    render(
      <Form model={model}>
        <UptimeHeadersField name="headers" />
      </Form>
    );

    // Spaces and special characters are stripped
    await userEvent.type(input('Name of header 1'), 'My Awesome Header!');
    expect(model.getValue('headers')).toEqual([['MyAwesomeHeader', '']]);
  });
});
