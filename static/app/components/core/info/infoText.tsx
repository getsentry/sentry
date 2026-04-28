import styled from '@emotion/styled';
import type {DistributedOmit} from 'type-fest';

import {Text, type TextProps} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

type InfoTextProps<T extends 'span' | 'p' | 'label' | 'div'> = DistributedOmit<
  TextProps<T>,
  'title'
> & {
  title: React.ReactNode;
};

export function InfoText<T extends 'span' | 'p' | 'label' | 'div' = 'span'>({
  title,
  children,
  ...textProps
}: InfoTextProps<T>) {
  if (!title) {
    return <Text {...textProps}>{children}</Text>;
  }
  return (
    <Tooltip title={title} skipWrapper isHoverable showUnderline>
      <StyledText {...textProps} tabIndex={0}>
        {children}
      </StyledText>
    </Tooltip>
  );
}

const StyledText = styled(Text)`
  outline: none;

  &:focus-visible {
    ${p => p.theme.focusRing()}
  }
`;
