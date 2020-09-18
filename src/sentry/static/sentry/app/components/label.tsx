import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {Color} from 'app/utils/theme';

// TODO(matej): looks like there will be more of these labels in the future.
// Once all color combinations are designed, maybe it would make sense to
// refactor this component to accept words like "warning" and "danger"
// instead of manually passing backgroundColor and textColor.
type Props = {
  text: React.ReactNode;
  textColor: Color;
  backgroundColor: Color;
  tooltip?: React.ReactNode;
  className?: string;
};

function Label({text, textColor, backgroundColor, tooltip, className}: Props) {
  return (
    <Wrapper className={className}>
      <Tooltip title={tooltip} disabled={!tooltip}>
        <Background color={backgroundColor}>
          <Text color={textColor}>{text}</Text>
        </Background>
      </Tooltip>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: inline-block;
  line-height: ${p => p.theme.fontSizeExtraSmall};
`;

const Background = styled('div')<{color: Color}>`
  background-color: ${p => p.theme[p.color]};
  padding: ${space(0.25)} ${space(0.5)};
  border-radius: ${p => p.theme.borderRadius};
`;

const Text = styled('span')<{color: Color}>`
  color: ${p => p.theme[p.color]};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

export default Label;
