import {Fragment, ReactChild, useEffect} from 'react';
import styled from '@emotion/styled';

import {SpanEvidenceKeyValueList} from 'sentry/components/events/interfaces/performance/spanEvidenceKeyValueList';
import {getSpanInfoFromTransactionEvent} from 'sentry/components/events/interfaces/performance/utils';
import {GroupPreviewHovercard} from 'sentry/components/groupPreviewTooltip/groupPreviewHovercard';
import {useDelayedLoadingState} from 'sentry/components/groupPreviewTooltip/utils';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {EventTransaction} from 'sentry/types';
import useApiRequests from 'sentry/utils/useApiRequests';
import useOrganization from 'sentry/utils/useOrganization';

type SpanEvidencePreviewProps = {
  children: ReactChild;
  eventId?: string;
  groupId?: string;
  projectSlug?: string;
};

type SpanEvidencePreviewBodyProps = {
  endpointUrl: string;
  onRequestBegin: () => void;
  onRequestEnd: () => void;
  onUnmount: () => void;
};

type Response = {
  event: EventTransaction;
};

const makeGroupPreviewRequestUrl = ({
  orgSlug,
  eventId,
  groupId,
  projectSlug,
}: {
  orgSlug: string;
  eventId?: string;
  groupId?: string;
  projectSlug?: string;
}) => {
  if (eventId && projectSlug) {
    return `/projects/${orgSlug}/${projectSlug}/events/${eventId}/`;
  }

  if (groupId) {
    return `/issues/${groupId}/events/latest/`;
  }

  return null;
};

const SpanEvidencePreviewBody = ({
  endpointUrl,
  onRequestBegin,
  onRequestEnd,
  onUnmount,
}: SpanEvidencePreviewBodyProps) => {
  const {data, isLoading, hasError} = useApiRequests<Response>({
    endpoints: [
      ['event', endpointUrl, {query: {referrer: 'api.issues.preview-performance'}}],
    ],
    onRequestError: onRequestEnd,
    onRequestSuccess: onRequestEnd,
  });

  useEffect(() => {
    onRequestBegin();

    return onUnmount;
  }, [onRequestBegin, onUnmount]);

  if (isLoading) {
    return (
      <EmptyWrapper>
        <LoadingIndicator hideMessage size={32} />
      </EmptyWrapper>
    );
  }

  if (hasError) {
    return <EmptyWrapper>{t('Failed to load preview')}</EmptyWrapper>;
  }

  const spanInfo = data.event && getSpanInfoFromTransactionEvent(data.event);

  if (spanInfo && data.event) {
    return (
      <SpanEvidencePreviewWrapper data-test-id="span-evidence-preview-body">
        <SpanEvidenceKeyValueList
          transactionName={data.event.title}
          parentSpan={spanInfo.parentSpan}
          repeatingSpan={spanInfo.repeatingSpan}
        />
      </SpanEvidencePreviewWrapper>
    );
  }

  return (
    <EmptyWrapper>
      {t('There is no span evidence available for this issue.')}
    </EmptyWrapper>
  );
};

export const SpanEvidencePreview = ({
  children,
  groupId,
  eventId,
  projectSlug,
}: SpanEvidencePreviewProps) => {
  const organization = useOrganization();
  const endpointUrl = makeGroupPreviewRequestUrl({
    groupId,
    eventId,
    projectSlug,
    orgSlug: organization.slug,
  });
  const {shouldShowLoadingState, onRequestBegin, onRequestEnd, reset} =
    useDelayedLoadingState();

  if (!endpointUrl) {
    return <Fragment>{children}</Fragment>;
  }

  return (
    <GroupPreviewHovercard
      hide={!shouldShowLoadingState}
      body={
        <SpanEvidencePreviewBody
          onRequestBegin={onRequestBegin}
          onRequestEnd={onRequestEnd}
          onUnmount={reset}
          endpointUrl={endpointUrl}
        />
      }
    >
      {children}
    </GroupPreviewHovercard>
  );
};

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
