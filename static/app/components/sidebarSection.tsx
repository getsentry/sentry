import styled from '@emotion/styled';

export const Wrap = styled('div')`
  margin-bottom: ${p => p.theme.space(4)};
`;

export const Title = styled('h6')`
  color: ${p => p.theme.subText};
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space(0.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: ${p => p.theme.space(1)} 0 0;
`;

export const IconWrapper = styled('div')`
  color: ${p => p.theme.subText};
  margin-left: ${p => p.theme.space(0.5)};
`;

export const Content = styled('div')`
  margin-top: ${p => p.theme.space(1)};
`;
