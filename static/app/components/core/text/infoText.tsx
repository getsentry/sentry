import styled from '@emotion/styled';

import {Tooltip} from '@sentry/scraps/tooltip';

import {Text, type TextProps} from './text';

type InfoTextProps = TextProps<'span'> & {
  title: React.ReactNode;
};

export function InfoText({title, children, ...textProps}: InfoTextProps) {
  return (
    <Tooltip title={title} skipWrapper showUnderline>
      <StyledText {...textProps} tabIndex={0}>
        {children}
      </StyledText>
    </Tooltip>
  );
}

const StyledText = styled(Text)`
  cursor: help;
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
