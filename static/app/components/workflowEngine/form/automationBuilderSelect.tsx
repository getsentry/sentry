import styled from '@emotion/styled';

import {Select, type ControlProps, type SelectValue} from '@sentry/scraps/select';

export function AutomationBuilderSelect<
  TValue,
  TOption extends SelectValue<TValue> = SelectValue<TValue>,
>(props: ControlProps<TValue, TOption>) {
  return <StyledSelect size="sm" {...props} />;
}

const StyledSelect = styled(Select)`
  min-width: 180px;
  padding: 0;
  > div {
    padding-left: 0;
  }
  border: none;
` as typeof Select;
