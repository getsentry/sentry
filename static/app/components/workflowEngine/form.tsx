import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const StickyFooter = styled('div')`
  position: sticky;
  bottom: 0;
  right: 0;
  width: 100%;
  padding: ${space(2)} ${space(4)};
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.translucentGray200};
  box-shadow: 0px -4px 24px 0px rgba(43, 34, 51, 0.12);
  display: flex;
  align-items: center;
  justify-content: space-between;
`;
