import NewBooleanField from 'sentry/components/forms/booleanField';
import Form from 'sentry/components/forms/form';
import RadioField from 'sentry/components/forms/radioField';
import RangeField from 'sentry/components/forms/rangeField';
import SelectField from 'sentry/components/forms/selectField';
import TextField from 'sentry/components/forms/textField';

export default {
  title: 'Components/Forms/Form',
  args: {
    alignRight: false,
    required: false,
    visible: true,
    disabled: false,
    flexibleControlStateSize: true,
    inline: true,
    stacked: true,
  },
};

export const Default = ({...fieldProps}) => {
  return (
    <Form>
      <TextField
        name="textfieldflexiblecontrol"
        label="Text Field With Flexible Control State Size"
        placeholder="Type text and then delete it"
        {...fieldProps}
      />
      <NewBooleanField name="field" label="New Boolean Field" {...fieldProps} />
      <RadioField
        name="radio"
        label="Radio Field"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        {...fieldProps}
      />
      <SelectField
        name="select"
        label="Select Field"
        choices={[
          ['choice_one', 'Choice One'],
          ['choice_two', 'Choice Two'],
          ['choice_three', 'Choice Three'],
        ]}
        {...fieldProps}
      />
      <RangeField
        name="rangeField"
        label="Range Field"
        min={1}
        max={10}
        step={1}
        value={1}
        formatLabel={value => {
          return `${value} Toaster Strudle${value > 1 ? 's' : ''}`;
        }}
        {...fieldProps}
      />
    </Form>
  );
};

Default.storyName = 'Form';
Default.parameters = {
  docs: {
    description: {
      story:
        'Use the knobs to see how the different field props that can be used affect the form layout.',
    },
  },
};
