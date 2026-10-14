import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface DocumentationHintProps {
  children: React.ReactNode;
  /**
   * The link to the documentation for this page.
   */
  docsUrl: string;
}

export function DocumentationHint({children, docsUrl}: DocumentationHintProps) {
  return (
    <Stack align="start" gap="md">
      <Text align="left">{children}</Text>
      <ExternalLink href={docsUrl}>{t('Read the Docs')}</ExternalLink>
    </Stack>
  );
}
