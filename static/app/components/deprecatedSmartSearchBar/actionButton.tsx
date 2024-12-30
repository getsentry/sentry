// eslint-disable-next-line no-restricted-imports
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';

export const ActionButton = styled(Button)<{isActive?: boolean}>`
  color: ${p => (p.isActive ? p.theme.linkColor : p.theme.subText)};
  width: 18px;
  height: 18px;
  padding: 2px;
  min-height: auto;

  &,
  &:hover,
  &:focus {
    background: transparent;
  }

  &:hover {
    color: ${p => p.theme.gray400};
  }
`;

ActionButton.defaultProps = {
  type: 'button',
  borderless: true,
  size: 'zero',
};
