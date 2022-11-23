import {css} from '@emotion/react';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import {FieldGroupProps} from './types';

type FieldDescriptionProps = Pick<FieldGroupProps, 'inline'>;

const inlineStyle = (p: FieldDescriptionProps) =>
  p.inline
    ? css`
        width: 50%;
        padding-right: 10px;
        flex-shrink: 0;
      `
    : css`
        margin-bottom: ${space(1)};
      `;

const FieldDescription = styled('label')<FieldDescriptionProps>`
  font-weight: normal;
  margin-bottom: 0;

  ${inlineStyle};
`;

export default FieldDescription;
