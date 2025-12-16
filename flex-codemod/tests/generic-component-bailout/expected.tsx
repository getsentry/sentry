import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {RadioGroup} from 'sentry/components/forms/controls/radioGroup';

type WidgetType = 'line' | 'bar' | 'area';

const StyledRadioGroup = styled(RadioGroup<WidgetType>)`
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
      <Flex gap="sm">Regular content</Flex>
    </div>
  );
}
