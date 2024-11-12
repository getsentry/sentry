import type React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/inputGroup';
import {space} from 'sentry/styles/space';

interface Props extends React.ComponentProps<typeof InputGroup.Input> {}

export function PercentInput(props: Props) {
  return (
    <InputGroup
      css={css`
        width: 160px;
      `}
    >
      <InputGroup.Input type="number" min={0} max={100} {...props} />
      <InputGroup.TrailingItems>
        <TrailingPercent>%</TrailingPercent>
      </InputGroup.TrailingItems>
    </InputGroup>
  );
}

const TrailingPercent = styled('strong')`
  padding: 0 ${space(0.25)};
`;
