import styled from '@emotion/styled';

type Props = {
  noMargin?: boolean;
};

export const TextBlock = styled('div')<Props>`
  line-height: 1.5;
  margin-bottom: ${p => (p.noMargin ? undefined : p.theme.space['2xl'])};
`;
