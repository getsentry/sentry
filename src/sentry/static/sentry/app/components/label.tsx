import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {Color} from 'app/utils/theme';

function getColors(type: Props['type']): [Color, Color] {
  switch (type) {
    case 'warning':
      return ['orange100', 'orange300'];
    case 'success':
      return ['green100', 'green300'];
    case 'error':
      return ['red100', 'red300'];
    case 'info':
    default:
      return ['blue100', 'blue300'];
  }
}

type Props = {
  text: React.ReactNode;
  type?: 'info' | 'warning' | 'success' | 'error' | 'muted';
  tooltip?: React.ReactNode;
  className?: string;
};

function Label({text, type = 'info', tooltip, className}: Props) {
  const [backgroundColor, textColor] = getColors(type);
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
