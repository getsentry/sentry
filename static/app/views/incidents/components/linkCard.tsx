import styled from '@emotion/styled';

import {Link} from 'sentry/components/core/link';

export const LinkCard = styled(Link)`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.md};
  transition: transform 0.1s ease-in-out;
  z-index: 1;
  background: ${p => p.theme.tokens.background.primary};
  &:hover {
    transform: translateY(-2px);
    &:before {
      transform: translateY(2px);
    }
  }
  &:before {
    content: '';
    position: absolute;
    height: 100%;
    top: 4px;
    left: -1px;
    right: -1px;
    border-radius: ${p => p.theme.borderRadius};
    z-index: -1;
    background: ${p => p.theme.tokens.border.primary};
    transition: transform 0.1s ease-in-out;
  }

  &:after {
    content: '';
    position: absolute;
    inset: 0;
    z-index: -1;
    border-radius: ${p => p.theme.borderRadius};
    background: ${p => p.theme.tokens.background.primary};
  }
`;
