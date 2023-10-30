import {ComponentProps} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';

import {NoContextWrapper} from './styles';

type NoContextProps = {
  isLoading: boolean;
};

export function NoContext({isLoading}: NoContextProps) {
  return isLoading ? (
    <NoContextWrapper>
      <LoadingIndicator
        data-test-id="quick-context-loading-indicator"
        hideMessage
        mini
        style={{width: '24px'}}
      />
    </NoContextWrapper>
  ) : (
    <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
  );
}

export const HoverWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;
export function QuickContextHoverWrapper(
  props: ComponentProps<typeof QuickContextHovercard>
) {
  return (
    <HoverWrapper>
      <QuickContextHovercard {...props} />
    </HoverWrapper>
  );
}
