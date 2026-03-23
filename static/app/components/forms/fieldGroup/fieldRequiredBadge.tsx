import styled from '@emotion/styled';

export const FieldRequiredBadge = styled('div')`
  display: inline-block;
  background: ${p => p.theme.colors.red400};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  text-indent: -9999em;
  vertical-align: super;
  margin-left: ${p => p.theme.space.xs};
`;
