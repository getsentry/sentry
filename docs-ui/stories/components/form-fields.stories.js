import {action} from '@storybook/addon-actions';

import CompactSelect from 'sentry/components/compactSelect';
import CompositeSelect from 'sentry/components/compositeSelect';
import RadioGroup from 'sentry/components/forms/controls/radioGroup';
import RangeSlider from 'sentry/components/forms/controls/rangeSlider';
import NewBooleanField from 'sentry/components/forms/fields/booleanField';
import CheckboxField from 'sentry/components/forms/fields/checkboxField';
import DatePickerField from 'sentry/components/forms/fields/datePickerField';
import FileField from 'sentry/components/forms/fields/fileField';
import RadioField from 'sentry/components/forms/fields/radioField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import {Panel} from 'sentry/components/panels';
import {RadioGroupRating} from 'sentry/components/radioGroupRating';
import Switch from 'sentry/components/switchButton';
import TextCopyInput from 'sentry/components/textCopyInput';

export default {
  title: 'Components/Forms/Fields',
};

export const _TextField = () => (
  <Panel>
    <Form initialData={{context: {location: 'cat'}}}>
      <TextField
        name="simpletextfieldvalue"
        label="Simple Text Field with Value"
        placeholder="Simple Text Field"
        defaultValue="With a value present"
      />
      <TextField
        name="simpletextfieldplaceholder"
        label="Simple Text Field with Placeholder"
        placeholder="This is placeholder text"
      />
      <TextField
        name="simpletextfieldvaluedisabled"
        label="Disabled - Simple Text Field with Value"
        placeholder="Simple Text Field"
        defaultValue="With a value present"
        disabled
      />
      <TextField
        name="simpletextfieldplaceholderdisabled"
        label="Disabled - Simple Text Field with Placeholder"
        placeholder="This is placeholder text in a disabled field"
        disabled
      />
      <TextField
        name="textfieldflexiblecontrol"
        label="Text Field With Flexible Control State Size"
        placeholder="Type text and then delete it"
        required
        flexibleControlStateSize
      />
      <TextField
        name="textfielddisabled"
        label="Text field with disabled reason"
        placeholder="I am disabled"
        disabled
        disabledReason="This is the reason this field is disabled"
      />
    </Form>
  </Panel>
);

_TextField.storyName = 'Text';
_TextField.parameters = {
  docs: {
    description: {
      story: 'Simple text field',
    },
  },
};

export const _TextareaField = ({autosize, rows}) => (
  <Panel>
    <Form initialData={{context: {location: 'cat'}}}>
      <TextareaField
        name="simpletextfieldvalue"
        label="Simple Textarea Field with Value"
        help="Additional help text"
        placeholder="Simple Textarea Field"
        defaultValue="With a value present"
      />
      <TextareaField
        name="simpletextfieldautosize"
        autosize={autosize}
        label="Textarea field with autosize"
        rows={rows}
        placeholder="Use knobs to control rows and autosize setting"
      />
      <TextareaField
        name="simpletextfieldvaluedisabled"
        label="Disabled - Simple Textarea Field with Value"
        placeholder="Simple Textarea Field"
        defaultValue="With a value present"
        disabled
      />
      <TextareaField
        name="simpletextfieldplaceholderdisabled"
        label="Disabled - Simple Textarea Field with Placeholder"
        placeholder="This is placeholder text in a disabled field"
        disabled
      />
      <TextareaField
        name="textfieldflexiblecontrol"
        label="Textarea Field With Flexible Control State Size"
        placeholder="Type text and then delete it"
        required
        flexibleControlStateSize
      />
      <TextareaField
        name="textfielddisabled"
        label="Textarea Field with disabled reason"
        placeholder="I am disabled"
        disabled
        disabledReason="This is the reason this field is disabled"
      />
      <TextareaField
        name="textareafielderror"
        label="Textarea Field with error"
        placeholder="I have an error"
        error="An error has occurred"
      />
    </Form>
  </Panel>
);

_TextareaField.storyName = 'Textarea';
_TextareaField.args = {
  autosize: true,
  rows: 1,
};

export const __BooleanField = () => (
  <Form>
    <NewBooleanField name="field" label="New Boolean Field" />
  </Form>
);

__BooleanField.storyName = 'Boolean';

export const _CheckboxField = () => (
  <Form>
    <CheckboxField name="agree" label="Do you agree?" />
    <CheckboxField
      name="compelled"
      label="You are compelled to agree"
      help="More content to help you decide."
      required
    />
  </Form>
);

_CheckboxField.storyName = 'Checkbox';

export const _DatePickerField = () => (
  <Form>
    <DatePickerField name="field" label="Date Picker Field" />
  </Form>
);

_DatePickerField.storyName = 'Datepicker';

export const _RadioField = () => (
  <Form>
    <RadioField
      name="radio"
      label="Radio Field"
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
        ['choice_three', 'Choice Three'],
      ]}
    />
    <RadioField
      orientInline
      name="inline-radio"
      label="Inline Radios"
      choices={[
        ['choice_one', 'Choice One'],
        ['choice_two', 'Choice Two'],
      ]}
    />
  </Form>
);

export const __FileField = () => (
  <Form>
    <FileField name="field" label="File Field" />
  </Form>
);

__FileField.storyName = 'File';

_RadioField.storyName = 'Radio';

export const _SelectField = () => (
  <Form>
    <SelectField
      name="select"
      label="Select Field"
      options={[
        {value: 'choice_one', label: 'Choice One'},
        {value: 'choice_two', label: 'Choice Two'},
        {value: 'choice_three', label: 'Choice Three'},
      ]}
    />
  </Form>
);

_SelectField.storyName = 'Select';

export const SelectFieldMultiple = () => (
  <Form>
    <SelectField
      name="select"
      label="Multi Select"
      multiple
      options={[
        {value: 'choice_one', label: 'Choice One'},
        {value: 'choice_two', label: 'Choice Two'},
        {value: 'choice_three', label: 'Choice Three'},
      ]}
    />
  </Form>
);

SelectFieldMultiple.storyName = 'Select - Multiple';

export const SelectFieldGrouped = () => (
  <Form>
    <SelectField
      name="select"
      label="Grouped Select"
      options={[
        {
          label: 'Group 1',
          options: [
            {value: 'choice_one', label: 'Choice One'},
            {value: 'choice_two', label: 'Choice Two'},
          ],
        },
        {
          label: 'Group 2',
          options: [
            {value: 'choice_three', label: 'Choice Three'},
            {value: 'choice_four', label: 'Choice Four'},
          ],
        },
      ]}
    />
  </Form>
);

SelectFieldGrouped.storyName = 'Select - Grouped';

export const SelectFieldInFieldLabel = () => (
  <Form>
    <SelectField
      name="select"
      label="Select With Label In Field"
      inFieldLabel="Label: "
      options={[
        {value: 'choice_one', label: 'Choice One'},
        {value: 'choice_two', label: 'Choice Two'},
        {value: 'choice_three', label: 'Choice Three'},
      ]}
    />
  </Form>
);

SelectFieldInFieldLabel.storyName = 'Select - Label in Field';
SelectFieldInFieldLabel.parameters = {
  docs: {
    description: {
      story: 'Select Control w/ Label In Field',
    },
  },
};

export const CompactSelectField = props => (
  <CompactSelect
    defaultValue="opt_one"
    options={[
      {value: 'opt_one', label: 'Option One'},
      {value: 'opt_two', label: 'Option Two'},
    ]}
    {...props}
  />
);

CompactSelectField.storyName = 'Select - Compact';
CompactSelectField.parameters = {
  docs: {
    description: {
      story: 'Compact',
    },
  },
};
CompactSelectField.args = {
  size: 'md',
  menuTitle: '',
  isSearchable: false,
  isDisabled: false,
  isClearable: false,
  isLoading: false,
  multiple: false,
  placeholder: 'Search…',
  closeOnSelect: true,
  shouldCloseOnBlur: true,
  isDismissable: true,
  offset: 8,
  crossOffset: 0,
  containerPadding: 8,
  placement: 'bottom left',
  triggerProps: {
    prefix: 'Prefix',
  },
};
CompactSelectField.argTypes = {
  placement: {
    options: [
      'top',
      'bottom',
      'left',
      'right',
      'top left',
      'top right',
      'bottom left',
      'bottom right',
      'left top',
      'left bottom',
      'right top',
      'right bottom',
    ],
    control: {type: 'radio'},
  },
  size: {
    options: ['md', 'sm', 'xs'],
    control: {type: 'radio'},
  },
};

export const CompositeSelectField = props => (
  <CompositeSelect
    sections={[
      {
        label: 'Group 1',
        value: 'group_1',
        defaultValue: 'choice_one',
        options: [
          {value: 'choice_one', label: 'Choice One'},
          {value: 'choice_two', label: 'Choice Two'},
        ],
      },
      {
        label: 'Group 2',
        value: 'group_2',
        defaultValue: ['choice_three'],
        multiple: true,
        options: [
          {value: 'choice_three', label: 'Choice Three'},
          {value: 'choice_four', label: 'Choice Four'},
        ],
      },
    ]}
    {...props}
  />
);
CompositeSelectField.storyName = 'Select - Composite';
CompositeSelectField.args = {...CompactSelectField.args};
delete CompositeSelectField.args.multiple;
CompositeSelectField.argTypes = CompactSelectField.argTypes;

export const NonInlineField = () => (
  <Form>
    <FormField name="radio" label="Radio Field" inline={false}>
      {({value, label, onChange}) => (
        <RadioGroup
          onChange={onChange}
          label={label}
          value={value}
          choices={[
            ['choice_one', 'Choice One', 'Description for Choice One'],
            ['choice_two', 'Choice Two', 'Description for Choice Two'],
            ['choice_three', 'Choice Three'],
          ]}
        />
      )}
    </FormField>
  </Form>
);

NonInlineField.storyName = 'Non-inline';
NonInlineField.parameters = {
  docs: {
    description: {
      story: 'Radio Group used w/ FormField',
    },
  },
};

export const _RadioGroupRating = () => (
  <RadioGroupRating
    name="feelingIfFeatureNotAvailableRating"
    options={{
      0: {
        label: 'Very Dissatisfied',
        description: "Not disappointed (It isn't really useful)",
      },
      1: {
        label: 'Dissatisfied',
      },
      2: {
        label: 'Neutral',
      },
      3: {
        label: 'Satisfied',
      },
      4: {
        description: "Very disappointed (It's a deal breaker)",
        label: 'Very Satisfied',
      },
    }}
    label="How satisfied are you with this feature?"
    inline={false}
    stacked
  />
);

_RadioGroupRating.storyName = 'Radio Group Rating';

_RadioGroupRating.parameters = {
  docs: {
    description: {
      story: 'Used to provide insights regarding opinions and experiences',
    },
  },
};

export const _RangeSlider = () => (
  <div style={{backgroundColor: '#fff', padding: 20}}>
    <RangeSlider
      name="rangeField"
      min={1}
      max={10}
      step={1}
      value={1}
      formatLabel={value => {
        return `${value} Toaster Strudle${value > 1 ? 's' : ''}`;
      }}
    />
  </div>
);

_RangeSlider.storyName = 'Range Slider';

export const WithoutAParentForm = ({onChange}) => {
  return (
    <div>
      <TextField
        name="simpletextfield"
        label="Simple Text Field"
        placeholder="Simple Text Field"
        onChange={onChange}
      />
      <NewBooleanField name="field" label="New Boolean Field" onChange={onChange} />
      <RadioField
        name="radio"
        label="Radio Field"
        onChange={onChange}
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
      />
      <Switch id="test" />
    </div>
  );
};

WithoutAParentForm.storyName = 'Without a Parent Form';
WithoutAParentForm.argTypes = {
  onChange: {action: 'onChange'},
};
WithoutAParentForm.parameters = {
  docs: {
    description: {
      story: 'New form fields used without having a parent Form',
    },
  },
};

export const __TextCopyInput = () => (
  <TextCopyInput onCopy={action('Copied!')}>Value to be copied </TextCopyInput>
);

__TextCopyInput.storyName = 'Text Copy';
