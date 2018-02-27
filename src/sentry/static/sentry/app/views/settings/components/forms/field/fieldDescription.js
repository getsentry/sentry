import React from 'react';
import styled, {css} from 'react-emotion';

const inlineStyle = p =>
  p.inline
    ? css`
        width: 50%;
        padding-right: 10px;
        flex-shrink: 0;
      `
    : css`
        margin-bottom: 10px;
      `;

const FieldDescription = styled(({inline, ...props}) => <label {...props} />)`
  font-weight: normal;
  margin-bottom: 0;

  ${inlineStyle};
`;

export default FieldDescription;
