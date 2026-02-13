import styled from '@emotion/styled';

import {InfoTip} from '@sentry/scraps/info';
import {ExternalLink} from '@sentry/scraps/link';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
    <Container>
      {title}
      <ExternalLink href={docsUrl}>{linkLabel ?? t('Read the Docs')}</ExternalLink>
    </Container>
  );

  return <InfoTip title={contents} size="sm" variant="muted" position="right" />;
}

const Container = styled('div')`
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  text-align: left;
  gap: ${space(1)};
`;
