import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface Props {
  message?: string;
}

/**
 * Skeleton loading state for the AI replay summary.
 * Shows placeholder elements that match the structure of the loaded content.
 */
export function ReplayAiLoading({message}: Props) {
  return (
    <Fragment>
      {/* Summary section skeleton */}
      <SummarySection>
        <SummaryContent>
          <Placeholder height="18px" width="120px" />
          <Placeholder height="36px" width="100%" />
        </SummaryContent>
        <Flex gap="xs" align="center">
          <Placeholder height="28px" width="28px" />
          <Placeholder height="28px" width="28px" />
          <Placeholder height="28px" width="90px" />
        </Flex>
      </SummarySection>

      {/* Chapter list skeleton */}
      <ChapterListSection>
        <LoadingMessage>{message ?? t('Generating summary...')}</LoadingMessage>
        <ChapterRow>
          <Placeholder shape="circle" height="24px" width="24px" />
          <Placeholder height="16px" width="65%" />
          <Placeholder height="14px" width="90px" />
        </ChapterRow>
        <ChapterRow>
          <Placeholder shape="circle" height="24px" width="24px" />
          <Placeholder height="16px" width="55%" />
          <Placeholder height="14px" width="90px" />
        </ChapterRow>
        <ChapterRow>
          <Placeholder shape="circle" height="24px" width="24px" />
          <Placeholder height="16px" width="70%" />
          <Placeholder height="14px" width="90px" />
        </ChapterRow>
      </ChapterListSection>
    </Fragment>
  );
}

const SummarySection = styled('div')`
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  padding: ${space(1.5)};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  gap: ${space(2)};
`;

const SummaryContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1)};
  flex: 1;
`;

const ChapterListSection = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(2)};
  gap: ${space(1.5)};
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  text-align: center;
  padding: ${space(1)} 0;
`;

const ChapterRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(0.75)} 0;
`;
