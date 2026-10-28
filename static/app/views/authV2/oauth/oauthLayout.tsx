import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

export function OAuthLayout({children}: {children: ReactNode}) {
  return (
    <Stack width="100%" maxWidth="400px" gap="xl">
      <SentryDocumentTitle title={t('Authorize Application')} />
      <Heading as="h1" size="3xl" align="center">
        {t('Authorize Application')}
      </Heading>
      {children}
    </Stack>
  );
}
