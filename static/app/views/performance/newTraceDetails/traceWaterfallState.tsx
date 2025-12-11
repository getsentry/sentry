import {useMemo, useRef} from 'react';
import styled from '@emotion/styled';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

import type {TraceTree} from './traceModels/traceTree';

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

function TraceLoading({
  trace,
}: {
  trace: UseApiQueryResult<TraceTree.Trace, RequestError>;
}) {
  return (
    // Dont flash the animation on load because it's annoying
    <LoadingContainer animate={false}>
      <NoMarginIndicator size={24}>
        <div>
          {trace.failureCount > 0
            ? t('Failed to load the trace, trying again')
            : t('Assembling the trace')}
        </div>
      </NoMarginIndicator>
    </LoadingContainer>
  );
}

function TraceError({trace}: {trace: UseApiQueryResult<TraceTree.Trace, RequestError>}) {
  const message = useMemo(() => {
    const status: number | undefined = trace.error?.status;

    if (status === 404) {
      return tct(
        "Couldn't find this trace. This could be an issue on our end or caused by a truncated/malformed URL. Seeing this often? [feedbackLink]",
        {
          feedbackLink: <FeedbackLink />,
        }
      );
    }

    if (status === 404) {
      return tct(
        'The request was invalid. Think could be an issue on our end or caused by a truncated/malformed URL. Seeing this often? [feedbackLink]',
        {
          feedbackLink: <FeedbackLink />,
        }
      );
    }

    if (status === 504) {
      return tct(
        "Query timed out. This might be a really large trace - we're working on handling these too. Seeing this often? [feedbackLink]",
        {
          feedbackLink: <FeedbackLink />,
        }
      );
    }

    return tct('Seeing this often? [feedbackLink]', {
      feedbackLink: <FeedbackLink />,
    });
  }, [trace.error?.status]);

  return (
    <LoadingContainer animate error>
      <ErrorTitle>{t('Woof, we failed to load your trace')}</ErrorTitle>
      <div>{message}</div>
    </LoadingContainer>
  );
}

function TraceEmpty() {
  const traceQueryParams = useTraceQueryParams();
  const timestamp = traceQueryParams.timestamp;

  // Traces take longer to ingest than spans, we could click on the id of a span
  // and be navigated to a trace that doesn't contain any data yet. We add a 10
  // minute buffer to account for this.
  const message =
    timestamp && new Date(timestamp * 1000) >= new Date(Date.now() - TEN_MINUTES_IN_MS)
      ? t("We're still processing this trace. Please try refreshing after a minute")
      : tct(
          'We were unable to find any spans for this trace. Seeing this often? [feedbackLink: Send us feedback]',
          {
            feedbackLink: <FeedbackLink />,
          }
        );

  return (
    <LoadingContainer animate>
      <div>{message}</div>
    </LoadingContainer>
  );
}

function FeedbackLink() {
  const linkref = useRef<HTMLAnchorElement>(null);
  const openForm = useFeedbackForm();

  return openForm ? (
    <a
      href="#"
      ref={linkref}
      onClick={e => {
        e.preventDefault();
        openForm();
      }}
    >
      {t('Send us feedback')}
    </a>
  ) : (
    <a href="mailto:support@sentry.io?subject=Trace%20fails%20to%20load">
      {t('Send us feedback')}
    </a>
  );
}

const LoadingContainer = styled('div')<{animate: boolean; error?: boolean}>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  left: 50%;
  top: 50%;
  position: absolute;
  gap: 10px;
  max-width: 300px;
  max-height: 150px;
  text-align: center;
  height: auto;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  z-index: 30;
  padding: 20px;
  background-color: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.border};
  transform-origin: 50% 50%;
  transform: translate(-50%, -50%);
  animation: ${p =>
    p.animate
      ? `${p.error ? 'showLoadingContainerShake' : 'showLoadingContainer'} 300ms cubic-bezier(0.61, 1, 0.88, 1) forwards`
      : 'none'};

  @keyframes showLoadingContainer {
    from {
      opacity: 0.6;
      transform: scale(0.99) translate(-50%, -50%);
    }
    to {
      opacity: 1;
      transform: scale(1) translate(-50%, -50%);
    }
  }

  @keyframes showLoadingContainerShake {
    0% {
      transform: translate(-50%, -50%);
    }
    25% {
      transform: translate(-51%, -50%);
    }
    75% {
      transform: translate(-49%, -50%);
    }
    100% {
      transform: translate(-50%, -50%);
    }
  }
`;

const NoMarginIndicator = styled(LoadingIndicator)`
  margin: 0;
`;

const ErrorTitle = styled('div')`
  font-size: ${p => p.theme.fontSize.lg};
`;

export const TraceWaterfallState = {
  Loading: TraceLoading,
  Error: TraceError,
  Empty: TraceEmpty,
};
