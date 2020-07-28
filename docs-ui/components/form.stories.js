import React from 'react';
import {boolean} from '@storybook/addon-knobs';
import {withInfo} from '@storybook/addon-info';

import Form from 'app/views/settings/components/forms/form';
import NewBooleanField from 'app/views/settings/components/forms/booleanField';
import RadioField from 'app/views/settings/components/forms/radioField';
import RangeField from 'app/views/settings/components/forms/rangeField';
import SelectField from 'app/views/settings/components/forms/selectField';
import TextField from 'app/views/settings/components/forms/textField';

export default {
  title: 'Forms/Form',
};

export const Default = withInfo(
  'Use the knobs to see how the different field props that can be used affect the form layout.'
)(() => {
  const fieldProps = {
    alignRight: boolean('Align right', false),
    required: boolean('Required', false),
    visible: boolean('Visible', true),
    disabled: boolean('Disabled', false),
    flexibleControlStateSize: boolean('Flexible Control State Size', true),
    inline: boolean('Inline (Label and Control on same line)', true),
    stacked: boolean('Stacked (Fields are on top of each other without a border)', true),
  };
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
});

Default.story = {
  name: 'default',
};
