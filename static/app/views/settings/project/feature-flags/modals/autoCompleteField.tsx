import styled from '@emotion/styled';

import SelectField from 'sentry/components/forms/selectField';

import {formatCreateTagLabel} from '../../server-side-sampling/modals/specificConditionsModal/utils';

type Props = {
  name: string;
  onChange: (value: any) => void;
  placeholder: string;
  options?: {label: string; value: string}[];
};

export function AutoCompleteField({name, onChange, options, placeholder}: Props) {
  return (
    <StyledSelectField
      name={name}
      options={options}
      onChange={onChange}
      placeholder={placeholder}
      formatCreateLabel={formatCreateTagLabel}
      isValidNewOption={(inputValue, _selectValue, optionsArray) => {
        // Do not show "Add new" for existing options
        if (optionsArray.some(option => option.value === inputValue)) {
          return false;
        }
        // Tag values cannot be empty and must have a maximum length of 200 characters
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/store/normalize.rs#L230-L236
        // In addition to that, it cannot contain a line-feed (newline) character
        // https://github.com/getsentry/relay/blob/d8223d8d03ed4764063855eb3480f22684163d92/relay-general/src/protocol/tags.rs#L8
        return (
          !/\\n/.test(inputValue) &&
          inputValue.trim().length > 0 &&
          inputValue.trim().length <= 200
        );
      }}
      filterOption={(option, filterText) => option.data.value.indexOf(filterText) > -1}
      inline={false}
      hideControlState
      flexibleControlStateSize
      required
      stacked
      creatable
      allowClear
      async
      cacheOptions
      defaultOptions
    />
  );
}

export const StyledSelectField = styled(SelectField)`
  padding: 0;
  border-bottom: none;
  width: 100%;
`;
