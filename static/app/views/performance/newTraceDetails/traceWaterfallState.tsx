import {useRef} from 'react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t, tct} from 'sentry/locale';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import type {TraceQueryResult} from 'sentry/views/performance/newTraceDetails/traceApi/useTrace';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

interface TraceWaterfallStateProps {
  trace: TraceQueryResult;
}

function TraceLoading({trace}: TraceWaterfallStateProps) {
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

function TraceError({trace}: TraceWaterfallStateProps) {
  return (
    <LoadingContainer animate error>
      <ErrorTitle>{t('Woof, we failed to load your trace')}</ErrorTitle>
      <div>{getTraceErrorMessage(trace.error?.status)}</div>
    </LoadingContainer>
  );
}

const helpComponents = {feedbackLink: <FeedbackLink />};

function getTraceErrorMessage(status: number | undefined) {
  switch (status) {
    case 400:
    case 500:
      return tct(
        'The request was invalid. This could be an issue on our end or caused by a truncated/malformed URL. Seeing this often? [feedbackLink]',
        helpComponents
      );

    case 404:
      return tct(
        "Couldn't find this trace. This could be an issue on our end or caused by a truncated/malformed URL. Seeing this often? [feedbackLink]",
        helpComponents
      );

    case 429:
    case 504:
      return tct(
        "Query timed out. This might be a really large trace - we're working on handling these too. Seeing this often? [feedbackLink]",
        helpComponents
      );

    default:
      return tct('Seeing this often? [feedbackLink]', helpComponents);
  }
}

function TraceEmpty() {
  const traceQueryParams = useTraceQueryParams();
  const timestamp = traceQueryParams.timestamp;

  // Traces take longer to ingest than spans, we could click on the id of a span
  // and be navigated to a trace that doesn't contain any data yet. We add a 10
  // minute buffer to account for this.
  const message =
    timestamp &&
    new Date(timestamp * 1000) >= new Date(Date.now() - TEN_MINUTES_IN_MS) ? (
      t("We're still processing this trace. Please try refreshing after a minute")
    ) : (
      <div>
        <Text as="p">
          {t(
            'We were unable to find any spans for this trace. If you came here from Logs or Application Metrics, traces may use different sampling rules.'
          )}
        </Text>
        <br />
        <Text as="p">
          {tct(
            'Find similar traces in Explore using [crossEventQueryingLink: Cross Event Querying].',
            {
              crossEventQueryingLink: (
                <ExternalLink href="https://docs.sentry.io/product/explore/trace-explorer/#cross-event-querying-beta" />
              ),
            }
          )}
        </Text>
      </div>
    );

  return (
    <LoadingContainer animate>
      <Text as="div">{message}</Text>
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
  max-width: 450px;
  max-height: 150px;
  text-align: center;
  height: auto;
  font-size: ${p => p.theme.font.size.md};
  color: ${p => p.theme.tokens.content.secondary};
  z-index: 30;
  padding: 20px;
  background-color: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px solid ${p => p.theme.tokens.border.primary};
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
  font-size: ${p => p.theme.font.size.lg};
`;

export const TraceWaterfallState = {
  Loading: TraceLoading,
  Error: TraceError,
  Empty: TraceEmpty,
};
