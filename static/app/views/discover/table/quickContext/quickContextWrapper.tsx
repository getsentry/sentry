import type {ComponentProps} from 'react';

import {Flex} from '@sentry/scraps/layout';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {QuickContextHovercard} from 'sentry/views/discover/table/quickContext/quickContextHovercard';

import {NoContextWrapper} from './styles';

type NoContextProps = {
  isLoading: boolean;
};

export function NoContext({isLoading}: NoContextProps) {
  return isLoading ? (
    <NoContextWrapper>
      <LoadingIndicator data-test-id="quick-context-loading-indicator" mini size={24} />
    </NoContextWrapper>
  ) : (
    <NoContextWrapper>{t('Failed to load context for column.')}</NoContextWrapper>
  );
}

export function QuickContextHoverWrapper(
  props: ComponentProps<typeof QuickContextHovercard>
) {
  return (
    <Flex align="center" gap="sm">
      <QuickContextHovercard {...props} />
    </Flex>
  );
}
