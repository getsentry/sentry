import {ReactChild, useEffect} from 'react';
import styled from '@emotion/styled';

import {SpanEvidenceKeyValueList} from 'sentry/components/events/interfaces/performance/spanEvidenceKeyValueList';
import {GroupPreviewHovercard} from 'sentry/components/groupPreviewTooltip/groupPreviewHovercard';
import {
  useDelayedLoadingState,
  usePreviewEvent,
} from 'sentry/components/groupPreviewTooltip/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventTransaction} from 'sentry/types';

type SpanEvidencePreviewProps = {
  children: ReactChild;
  groupId: string;
  query?: string;
};

type SpanEvidencePreviewBodyProps = {
  groupId: string;
  onRequestBegin: () => void;
  onRequestEnd: () => void;
  onUnmount: () => void;
  query?: string;
};

function SpanEvidencePreviewBody({
  groupId,
  onRequestBegin,
  onRequestEnd,
  onUnmount,
  query,
}: SpanEvidencePreviewBodyProps) {
  const {data, isLoading, isError} = usePreviewEvent<EventTransaction>({
    groupId,
    query,
  });

  useEffect(() => {
    if (isLoading) {
      onRequestBegin();
    } else {
      onRequestEnd();
    }

    return onUnmount;
  }, [isLoading, onRequestBegin, onRequestEnd, onUnmount]);

  if (isLoading) {
    return (
      <EmptyWrapper>
        <LoadingIndicator hideMessage size={32} />
      </EmptyWrapper>
    );
  }

  if (isError) {
    return <EmptyWrapper>{t('Failed to load preview')}</EmptyWrapper>;
  }

  if (data) {
    return (
      <SpanEvidencePreviewWrapper data-test-id="span-evidence-preview-body">
        <SpanEvidenceKeyValueList event={data} />
      </SpanEvidencePreviewWrapper>
    );
  }

  return (
    <EmptyWrapper>
      {t('There is no span evidence available for this issue.')}
    </EmptyWrapper>
  );
}

export function SpanEvidencePreview({
  children,
  groupId,
  query,
}: SpanEvidencePreviewProps) {
  const {shouldShowLoadingState, onRequestBegin, onRequestEnd, reset} =
    useDelayedLoadingState();

  return (
    <GroupPreviewHovercard
      hide={!shouldShowLoadingState}
      body={
        <SpanEvidencePreviewBody
          onRequestBegin={onRequestBegin}
          onRequestEnd={onRequestEnd}
          onUnmount={reset}
          groupId={groupId}
          query={query}
        />
      }
    >
      {children}
    </GroupPreviewHovercard>
  );
}

const EmptyWrapper = styled('div')`
  color: ${p => p.theme.subText};
  padding: ${space(1.5)};
  font-size: ${p => p.theme.fontSizeMedium};
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 56px;
`;

const SpanEvidencePreviewWrapper = styled('div')`
  width: 700px;
  padding: ${space(1.5)} ${space(1.5)} 0 ${space(1.5)};
`;
