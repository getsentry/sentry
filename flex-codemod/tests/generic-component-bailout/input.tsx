import styled from '@emotion/styled';

import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';

type WidgetType = 'line' | 'bar' | 'area';

const StyledRadioGroup = styled(RadioGroup<WidgetType>)`
  display: flex;
  gap: 8px;
`;

const RegularFlex = styled('div')`
  display: flex;
  gap: 8px;
`;

export default function Component() {
  return (
    <div>
      <StyledRadioGroup
        value="line"
        onChange={() => {}}
        choices={[
          ['line', 'Line'],
          ['bar', 'Bar'],
        ]}
      />
      <RegularFlex>Regular content</RegularFlex>
    </div>
  );
}
