import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {NumberInput} from 'sentry/components/core/input/numberInput';

export function AutomationBuilderNumberInput(props: ComponentProps<typeof NumberInput>) {
  return <InlineNumberInput min={0} {...props} />;
}

const InlineNumberInput = styled(NumberInput)`
  width: 90px;
  height: 28px;
  min-height: 28px;
`;
