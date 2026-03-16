import {InfoTip} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
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
  /**
   * The label to use for the external link.
   */
  linkLabel?: React.ReactNode;
}

export function PageHeadingQuestionTooltip({
  docsUrl,
  title,
  linkLabel,
}: PageHeadingQuestionTooltipProps) {
  const contents = (
    <Flex direction="column" align="start" gap="md">
      <Text align="left">{title}</Text>
      <ExternalLink href={docsUrl}>{linkLabel ?? t('Read the Docs')}</ExternalLink>
    </Flex>
  );

  return <InfoTip title={contents} size="sm" variant="muted" position="right" />;
}
