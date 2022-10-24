import selectEvent from 'react-select-event';

import {
  fireEvent,
  render,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import Form from 'sentry/components/forms/form';

import FormModel from '../model';

import BooleanField from './booleanField';
import CheckboxField from './checkboxField';
import EmailField from './emailField';
import HiddenField from './hiddenField';
import NumberField from './numberField';
import RadioField from './radioField';
import RangeField from './rangeField';
import SecretField from './secretField';
import SelectField from './selectField';
import SeparatorField from './separatorField';
import TextareaField from './textareaField';
import TextField from './textField';

describe('Field accessibility', function () {
  it('has appropriate aria attributes on all fields', async function () {
    // TODO(epurkhiser): The following fields are sill missing accessibility
    // check tests:
    //
    // - ChoiceMapper
    // - ProjectMapperField
    // - SentryProjectSelectorField
    // - TableField
    // - DatePickerField
    // - DateTimeField
    // - FileField

    // TODO(epurkhiser): It would be really nice if we could enforce that every
    // field that exists in `components/forms/fields/*` has a proper
    // accessibility test here.

    const model = new FormModel();

    render(
      <Form model={model}>
        <SeparatorField />
        <HiddenField name="hidden" defaultValue="itsHidden" />
        <TextField label="My Text Input" help="This is a text input" name="myTextInput" />
        <NumberField
          label="My Number Input"
          help="This is a number input"
          name="myNumberInput"
        />
        <EmailField
          label="My Email Input"
          help="This is a email input"
          name="myEmailInput"
        />
        <SecretField
          label="My Password"
          help="This is a password input"
          name="mySecretInput"
        />
        <TextareaField
          label="My Textarea"
          help="This is a text area input"
          name="myTextarea"
        />
        <CheckboxField
          label="My Checkbox"
          help="This is a checkbox (not a switch)"
          name="myCheckbox"
        />
        <BooleanField
          label="My Boolean"
          help="This is a boolean switch toggle"
          name="myBoolean"
        />
        <RadioField
          label="My Radios"
          choices={[
            ['thing_1', 'Thing 1', 'Thing 1 description'],
            ['thing_2', 'Thing 2', 'Thing 2 description'],
          ]}
          help="This is a radio set field"
          name="myRadios"
        />
        <RangeField
          label="My Range Slider"
          min={0}
          max={100}
          step={10}
          defaultValue={10}
          help="This is a range slider"
          name="myRangeSlider"
        />
        <SelectField
          label="My Select"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
          help="This is a select field field"
          name="mySelectbox"
        />
      </Form>
    );

    // Separator field
    expect(screen.getByRole('separator')).toBeInTheDocument();

    // Hidden field
    expect(model.getValue('hidden')).toBe('itsHidden');

    // Text Input
    const textInput = screen.getByRole('textbox', {name: 'My Text Input'});
    userEvent.type(textInput, 'testing');
    expect(textInput).toHaveValue('testing');
    expect(model.getValue('myTextInput')).toBe('testing');

    // Number field
    const numberInput = screen.getByRole('spinbutton', {name: 'My Number Input'});
    userEvent.type(numberInput, '1');
    expect(numberInput).toHaveValue(1);
    expect(model.getValue('myNumberInput')).toBe('1');

    // Password field
    const passwordField = screen.getByRole('textbox', {name: 'My Password'});
    userEvent.type(passwordField, 'hunter2');
    expect(passwordField).toHaveValue('hunter2');
    expect(model.getValue('mySecretInput')).toBe('hunter2');

    // Number field
    const emailInput = screen.getByRole('textbox', {name: 'My Email Input'});
    userEvent.type(emailInput, 'evan@p.com');
    expect(emailInput).toHaveValue('evan@p.com');
    expect(model.getValue('myEmailInput')).toBe('evan@p.com');

    // Textarea field
    const textarea = screen.getByRole('textbox', {name: 'My Textarea'});
    userEvent.type(textarea, 'evan@p.com');
    expect(textarea).toHaveValue('evan@p.com');
    expect(model.getValue('myEmailInput')).toBe('evan@p.com');

    // Checkbox field
    const checkbox = screen.getByRole('checkbox', {name: 'My Checkbox'});
    userEvent.click(checkbox);
    expect(checkbox).toBeChecked();
    expect(model.getValue('myCheckbox')).toBe(true);

    // Boolean switch field
    const boolean = screen.getByRole('checkbox', {name: 'My Boolean'});
    userEvent.click(boolean);
    expect(boolean).toBeChecked();
    expect(model.getValue('myBoolean')).toBe(true);

    // Radio group
    const radiogroup = screen.getByRole('radiogroup', {name: 'My Radios'});

    const radioItem1 = within(radiogroup).getByRole('radio', {name: 'Thing 1'});
    const radioItem2 = within(radiogroup).getByRole('radio', {name: 'Thing 2'});

    userEvent.click(radioItem1);
    expect(radioItem1).toBeChecked();
    expect(radioItem2).not.toBeChecked();
    expect(model.getValue('myRadios')).toBe('thing_1');

    userEvent.click(radioItem2);
    expect(radioItem1).not.toBeChecked();
    expect(radioItem2).toBeChecked();
    expect(model.getValue('myRadios')).toBe('thing_2');

    // Range slider field
    //
    // XXX(epurkhiser): slider inputs are not currently supported by userEvent,
    // fireEvent.change must be used
    const rangeSlider = screen.getByRole('slider', {name: 'My Range Slider'});
    fireEvent.change(rangeSlider, {target: {value: '20'}});
    expect(rangeSlider).toHaveValue('20');
    expect(model.getValue('myRangeSlider')).toBe(20);

    // Select field
    //
    // The input is a textbox, and we can test with `selectEvent`
    const select = screen.getByRole('textbox', {name: 'My Select'});

    await selectEvent.select(select, ['Item 1']);
    expect(model.getValue('mySelectbox')).toBe('item1');

    await selectEvent.select(select, ['Item 2']);
    expect(model.getValue('mySelectbox')).toBe('item2');
  });
});
