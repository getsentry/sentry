import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/deprecatedforms/form';
import SelectCreatableField from 'sentry/components/deprecatedforms/selectCreatableField';

describe('SelectCreatableField', function () {
  it('can add user input into select field when using options', function () {
    render(
      <SelectCreatableField options={[{value: 'foo', label: 'Foo'}]} name="fieldName" />
    );

    userEvent.type(screen.getByRole('textbox'), 'bar');
    expect(screen.getByRole('textbox')).toHaveValue('bar');

    // Click on create option
    userEvent.click(screen.getByText('Create "bar"'));

    // Should have 'bar' selected
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('can add user input into select field when using choices', function () {
    render(<SelectCreatableField choices={['foo']} name="fieldName" />);

    userEvent.type(screen.getByRole('textbox'), 'bar');
    expect(screen.getByRole('textbox')).toHaveValue('bar');

    // Click on create option
    userEvent.click(screen.getByText('Create "bar"'));

    // Should have 'bar' selected
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('can add user input into select field when using paired choices', function () {
    render(<SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />);

    userEvent.type(screen.getByRole('textbox'), 'bar');
    expect(screen.getByRole('textbox')).toHaveValue('bar');

    // Click on create option
    userEvent.click(screen.getByText('Create "bar"'));

    // Should have 'bar' selected
    expect(screen.getByText('bar')).toBeInTheDocument();
  });

  it('with Form context', function () {
    const submitMock = jest.fn();
    render(
      <Form onSubmit={submitMock}>
        <SelectCreatableField choices={[['foo', 'foo']]} name="fieldName" />
      </Form>,
      {}
    );

    userEvent.type(screen.getByRole('textbox'), 'bar');
    expect(screen.getByRole('textbox')).toHaveValue('bar');

    // Click on create option
    userEvent.click(screen.getByText('Create "bar"'));

    userEvent.click(screen.getByRole('button', {name: /save/i}));

    expect(submitMock).toHaveBeenCalledWith(
      {
        fieldName: 'bar',
      },
      expect.anything(),
      expect.anything()
    );
  });
});
