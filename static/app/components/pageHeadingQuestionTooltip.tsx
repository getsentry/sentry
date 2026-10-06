import {InfoTip} from '@sentry/scraps/info';
import {Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';

interface PageHeadingQuestionTooltipProps {
  /**
   * The link to the documentation for this page.
   */
  docsUrl: string;
  /**
   * The content to show in the tooltip.
   */
  title: React.ReactNode;
}

export function PageHeadingQuestionTooltip({
  docsUrl,
  title,
}: PageHeadingQuestionTooltipProps) {
  const contents = (
    <Stack align="start" gap="md">
      <Text align="left">{title}</Text>
      <ExternalLink href={docsUrl}>{t('Read the Docs')}</ExternalLink>
    </Stack>
  );

  return <InfoTip title={contents} size="sm" position="right" />;
}
