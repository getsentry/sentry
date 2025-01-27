import storyBook from 'sentry/stories/storyBook';
import useProjects from 'sentry/utils/useProjects';

import Form from '../form';

import BlankField from './blankField';
import BooleanField from './booleanField';
import CheckboxField from './checkboxField';
import DateTimeField from './dateTimeField';
import EmailField from './emailField';
import FileField from './fileField';
import HiddenField from './hiddenField';
import NumberField from './numberField';
import RadioField from './radioField';
import RangeField from './rangeField';
import SecretField from './secretField';
import SegmentedRadioField from './segmentedRadioField';
import SelectField from './selectField';
import SentryMemberTeamSelectorField from './sentryMemberTeamSelectorField';
import SentryProjectSelectorField from './sentryProjectSelectorField';
import SeparatorField from './separatorField';
import TextareaField from './textareaField';
import TextField from './textField';

export default storyBook(Form, story => {
  story('Available fields', () => {
    const {projects} = useProjects();

    return (
      <Form>
        <HiddenField name="hidden" defaultValue="itsHidden" />
        <BlankField label="My Blank Field" help="This is a blank field" />
        <TextField label="My Text Input" help="This is a text input" name="myTextInput" />
        <TextareaField
          label="My Textarea"
          help="This is a text area input"
          name="myTextarea"
        />
        <NumberField
          label="My Number Input"
          help="This is a number input"
          name="myNumberInput"
        />
        <NumberField
          label="My Number Input with units"
          help="This is a number input with units"
          name="myNumberInputWithUnits"
          placeholder={0}
          min={0}
          step={50}
          suffix="ms"
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
        <DateTimeField
          label="My Date Time Input"
          help="This is a date time input"
          name="myDatetimeInput"
        />
        <FileField
          label="My File Input"
          help="This is a file selector input"
          name="myFileInput"
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
        <SegmentedRadioField
          label="My Segmented Radio"
          choices={[
            ['thing_1', 'Thing 1', 'Thing 1 description'],
            ['thing_2', 'Thing 2', 'Thing 2 description'],
            ['thing_3', 'Thing 3', 'Thing 3 description'],
          ]}
          help="This is a segmented radio set field"
          name="mySegmentedRadios"
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
        <SelectField
          multiple
          label="My Multiple Select"
          options={[
            {value: 'item1', label: 'Item 1'},
            {value: 'item2', label: 'Item 2'},
          ]}
          help="This is a multiple select field filed"
          name="myMultiSelectBox"
        />
        <SentryProjectSelectorField
          label="My Project Selector"
          help="This is a project selector field"
          name="myProjectSelectbox"
          projects={projects}
        />
        <SentryMemberTeamSelectorField
          label="My Team / Member Selector"
          help="This is a team and membor selector field"
          name="myMemberTeamSelectbox"
        />
        <SeparatorField />
      </Form>
    );

    // TODO: Missing SelectAsyncField
    // TODO: Missing TableField
    // TODO: Missing ChoiceMapperField
    // TODO: Missing ProjectMapperField
  });
});
