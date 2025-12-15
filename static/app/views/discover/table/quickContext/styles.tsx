import styled from '@emotion/styled';

import type {FlexProps} from 'sentry/components/core/layout';
import {Flex, Stack} from 'sentry/components/core/layout';
import {space} from 'sentry/styles/space';

export function ContextContainer(props: FlexProps) {
  return <Stack {...props} />;
}

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
  font-size: ${p => p.theme.fontSize.lg};
  display: flex;
  align-items: center;
`;

export const Wrapper = styled('div')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  width: 320px;
  padding: ${space(1.5)};
`;

export const NoContextWrapper = styled('div')`
  color: ${p => p.theme.subText};
  height: 50px;
  padding: ${space(1)};
  font-size: ${p => p.theme.fontSize.md};
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  white-space: nowrap;
  min-width: 320px;
`;

export function ContextRow(props: FlexProps) {
  return <Flex justify="between" {...props} />;
}
