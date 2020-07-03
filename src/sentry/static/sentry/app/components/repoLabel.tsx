import styled from '@emotion/styled';

import overflowEllipsis from 'app/styles/overflowEllipsis';

const RepoLabel = styled('span')`
  /* label mixin from bootstrap */
  font-weight: 700;
  color: ${p => p.theme.white};
  text-align: center;
  white-space: nowrap;
  border-radius: 0.25em;
  /* end of label mixin from bootstrap */

  ${overflowEllipsis};

  display: inline-block;
  vertical-align: text-bottom;
  line-height: 1;
  background: ${p => p.theme.gray400};
  padding: 3px;
  max-width: 86px;
  font-size: ${p => p.theme.fontSizeSmall};
`;

export default RepoLabel;
