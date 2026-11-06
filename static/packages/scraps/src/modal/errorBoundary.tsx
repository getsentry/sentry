import {Fragment} from 'react';
import {ErrorBoundary} from 'react-error-boundary';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import type {ModalBoundaryProps} from './types';

export function DefaultModalBoundary({
  children,
  resetKey,
  onDismiss,
  header,
}: ModalBoundaryProps) {
  const {t} = useTranslation();
  return (
    <ErrorBoundary
      resetKeys={[resetKey]}
      fallback={
        <Fragment>
          {header}
          <Stack gap="lg" role="alert">
            <Text>{t('There was a problem rendering the dialog.')}</Text>
            <Button onClick={onDismiss}>{t('Dismiss error')}</Button>
          </Stack>
        </Fragment>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
