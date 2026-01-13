import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';

interface Props {
  children: ReactNode;
  isLoading: boolean;
}

export default function FilterLoadingIndicator({children, isLoading}: Props) {
  return (
    <Stack justify="between" flexGrow={1} gap="md">
      {children}
      {isLoading ? (
        <Tooltip title={t('Data is still loading')}>
          <LoadingIndicator mini />
        </Tooltip>
      ) : null}
    </Stack>
  );
}
