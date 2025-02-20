import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

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

export const FieldDescription = styled('label')<FieldDescriptionProps>`
  font-weight: ${p => p.theme.fontWeightNormal};
  display: ${p => (p.displayNone ? 'none' : 'inline')};
  margin-bottom: 0;

  ${inlineStyle};
`;
