import type React from 'react';
import {forwardRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {InputGroup} from 'sentry/components/core/input/inputGroup';
import {space} from 'sentry/styles/space';

interface Props extends React.ComponentProps<typeof InputGroup.Input> {}

export const PercentInput = forwardRef<HTMLInputElement, Props>(
  function PercentInput(props, ref) {
    return (
      <InputGroup
        css={css`
          width: 120px;
        `}
      >
        <InputGroup.Input ref={ref} type="number" min={0} max={100} {...props} />
        <InputGroup.TrailingItems>
          <TrailingPercent>%</TrailingPercent>
        </InputGroup.TrailingItems>
      </InputGroup>
    );
  }
);

const TrailingPercent = styled('strong')`
  padding: 0 ${space(0.25)};
`;
