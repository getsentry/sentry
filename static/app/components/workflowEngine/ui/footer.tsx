import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const StickyFooter = styled('div')`
  position: sticky;
  margin-top: auto;
  margin-bottom: -56px;
  bottom: 0;
  right: 0;
  width: 100%;
  padding: ${space(2)} ${space(4)};
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.translucentGray200};
  box-shadow: ${p => p.theme.dropShadowHeavyTop};
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: ${p => p.theme.zIndex.initial};
`;

export const StickyFooterLabel = styled('p')`
  margin: 0;
  font-family: ${p => p.theme.text.family};
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.textColor};
`;
