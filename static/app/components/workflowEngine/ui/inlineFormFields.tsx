import styled from '@emotion/styled';

import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';

export const InlineInputField = styled(InputField)`
  padding: 0;
  width: 180px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

export const InlineNumberInput = styled(NumberField)`
  padding: 0;
  width: 90px;
  height: 28px;
  min-height: 28px;
  > div {
    padding-left: 0;
  }
`;

export const InlineSelectControl = styled(SelectField)`
  width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
`;

export const selectControlStyles = {
  control: (provided: any) => ({
    ...provided,
    minHeight: '28px',
    height: '28px',
    padding: 0,
  }),
};
