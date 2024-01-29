import type {ReactChild} from 'react';
import {useEffect} from 'react';
import styled from '@emotion/styled';

import KeyValueList from 'sentry/components/events/interfaces/keyValueList';
import {GroupPreviewHovercard} from 'sentry/components/groupPreviewTooltip/groupPreviewHovercard';
import {
  useDelayedLoadingState,
  usePreviewEvent,
} from 'sentry/components/groupPreviewTooltip/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

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
  onRequestBegin,
  onRequestEnd,
  onUnmount,
  groupId,
  query,
}: SpanEvidencePreviewBodyProps) {
  const {data, isLoading, isError} = usePreviewEvent({groupId, query});

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

  const evidenceDisplay = data?.occurrence?.evidenceDisplay;

  if (evidenceDisplay?.length) {
    return (
      <SpanEvidencePreviewWrapper data-test-id="evidence-preview-body">
        <KeyValueList
          data={evidenceDisplay.map(item => ({
            key: item.name,
            subject: item.name,
            value: item.value,
          }))}
          shouldSort={false}
        />
      </SpanEvidencePreviewWrapper>
    );
  }

  return (
    <EmptyWrapper>{t('There is no evidence available for this issue.')}</EmptyWrapper>
  );
}

export function EvidencePreview({children, groupId, query}: SpanEvidencePreviewProps) {
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
