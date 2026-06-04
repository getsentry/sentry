import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import type {FieldGroupProps} from './types';

interface FieldDescriptionProps extends Pick<FieldGroupProps, 'inline'> {
  /**
   * When set to true `display: none` will be applied and the Field
   * description will not be present in the layout, but will still be visible
   * for screen-readers since this element is used as the `aria-describedby` of
   * the control input componnt.
   */
  displayNone?: boolean;
}

const inlineStyle = (p: FieldDescriptionProps & {theme: Theme}) =>
  p.inline
    ? css`
        width: 50%;
        padding-right: 10px;
        flex-shrink: 0;
      `
    : css`
        margin-bottom: ${p.theme.space.md};
      `;

export const FieldDescription = styled('label')<FieldDescriptionProps>`
  font-weight: ${p => p.theme.font.weight.sans.regular};
  display: ${p => (p.displayNone ? 'none' : 'inline')};
  margin-bottom: 0;

  ${inlineStyle};
`;
