import React from 'react';

import {DynamicSamplingConditionOperator} from 'app/types/dynamicSampling';
import Field from 'app/views/settings/components/forms/field';
import TextareaField from 'app/views/settings/components/forms/textareaField';

import {getMatchFieldDescription} from './utils';

type Props = {
  condition: DynamicSamplingConditionOperator;
};

function MatchField({condition}: Props) {
  const {label, description} = getMatchFieldDescription(condition);

  if (!label) {
    return null;
  }

  return (
    <Field
      label={label}
      help={description}
      inline={false}
      required
      flexibleControlStateSize
      stacked
      showHelpInTooltip
    >
      <TextareaField
        name="match"
        style={{minHeight: 100}}
        placeholder="ex. 1* or [I3].[0-9].*"
        autosize
        inline={false}
        hideControlState
        stacked
      />
    </Field>
  );
}

export default MatchField;
