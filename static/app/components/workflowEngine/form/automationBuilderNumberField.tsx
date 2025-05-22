import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import NumberField from 'sentry/components/forms/fields/numberField';

type NumberFieldProps = ComponentProps<typeof NumberField>;

export default function AutomationBuilderNumberField(props: NumberFieldProps) {
  return (
    <StyledNumberField
      flexibleControlStateSize
      hideLabel
      inline
      style={{height: '28px', minHeight: '28px'}}
      {...props}
    />
  );
}

const StyledNumberField = styled(NumberField)`
  padding: 0;
  width: 90px;
  > div {
    padding-left: 0;
  }
`;
