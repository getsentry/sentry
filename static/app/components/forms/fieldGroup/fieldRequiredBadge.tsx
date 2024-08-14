import styled from '@emotion/styled';

const FieldRequiredBadge = styled('div')`
  display: inline-block;
  background: ${p => p.theme.red300};
  opacity: 0.6;
  width: 5px;
  height: 5px;
  border-radius: 5px;
  text-indent: -9999em;
  vertical-align: super;
  margin-left: ${p => p.theme.space(0.5)};
`;

export default FieldRequiredBadge;
