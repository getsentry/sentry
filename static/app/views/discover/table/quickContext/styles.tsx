import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const ContextContainer = styled('div')`
  display: flex;
  flex-direction: column;
`;

export const ContextHeader = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.75)};
`;

export const ContextTitle = styled('h6')`
  color: ${p => p.theme.subText};
  margin-bottom: 0 !important;
`;

export const ContextBody = styled('div')`
  width: 100%;
  text-align: left;
  font-size: ${p => p.theme.fontSizeLarge};
  display: flex;
  align-items: center;
`;

export const Wrapper = styled('div')`
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  width: 320px;
  padding: ${space(1.5)};
`;

export const NoContextWrapper = styled('div')`
  color: ${p => p.theme.subText};
  height: 50px;
  padding: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  min-width: 320px;
`;

export const ContextRow = styled('div')`
  display: flex;
  justify-content: space-between;
`;
