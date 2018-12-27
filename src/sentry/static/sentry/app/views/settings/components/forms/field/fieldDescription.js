import React from 'react';
import styled, {css} from 'react-emotion';

import space from 'app/styles/space';

const inlineStyle = p =>
  p.inline
    ? css`
        width: 50%;
        padding-right: 10px;
        flex-shrink: 0;
      `
    : css`
        margin-bottom: ${space(1)};
      `;

const FieldDescription = styled(({inline, ...props}) => <label {...props} />)`
  font-weight: normal;
  margin-bottom: 0;

  ${inlineStyle};
`;

export default FieldDescription;
