import {css} from '@emotion/react';
import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

type FieldDescriptionProps = Pick<FieldGroupProps, 'inline'>;

const FieldDescription = styled('label')<FieldDescriptionProps>`
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: 0;

  ${p =>
    p.inline
      ? css`
          width: 50%;
          padding-right: 10px;
          flex-shrink: 0;
        `
      : css`
          margin-bottom: ${p.theme.space(1)};
        `};
`;

export default FieldDescription;
