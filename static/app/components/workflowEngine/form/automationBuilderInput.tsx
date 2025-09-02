import type {ComponentProps} from 'react';
import styled from '@emotion/styled';

import {Input} from 'sentry/components/core/input';

export function AutomationBuilderInput(props: ComponentProps<typeof Input>) {
  return <InlineInput type="text" {...props} />;
}

const InlineInput = styled(Input)`
  width: auto;
  height: 28px;
  min-height: 28px;
`;
