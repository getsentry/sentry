import type {ReactNode} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';

export function InvitationLayout({children}: {children: ReactNode}) {
  return (
    <Stack width="100%" maxWidth="360px" gap="2xl">
      <SentryDocumentTitle title={t('Accept Invitation')} />
      <Heading as="h1" size="3xl" align="center">
        {t('Accept Invitation')}
      </Heading>
      {children}
    </Stack>
  );
}
