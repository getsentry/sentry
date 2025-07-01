import {useRef} from 'react';
import styled from '@emotion/styled';

import useFeedbackWidget from 'sentry/components/feedback/widget/useFeedbackWidget';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {useTraceQueryParams} from 'sentry/views/performance/newTraceDetails/useTraceQueryParams';

const TEN_MINUTES_IN_MS = 10 * 60 * 1000;

function TraceLoading() {
  return (
    // Dont flash the animation on load because it's annoying
    <LoadingContainer animate={false}>
      <NoMarginIndicator size={24}>
        <div>{t('Assembling the trace')}</div>
      </NoMarginIndicator>
    </LoadingContainer>
  );
}

function TraceError() {
  const linkref = useRef<HTMLAnchorElement>(null);
  const feedback = useFeedbackWidget({buttonRef: linkref});

  return (
    <LoadingContainer animate error>
      <div>
        {t('Woof. We failed to load your trace. If you need to yell at someone, ')}
      </div>
      <div>
        {feedback ? (
          <a href="#" ref={linkref}>
            {t('send feedback')}
          </a>
        ) : (
          <a href="mailto:support@sentry.io?subject=Trace%20fails%20to%20load">
            {t('send feedback')}
          </a>
        )}
      </div>
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
      : t("This trace is so empty, even tumbleweeds don't roll here");

  return (
    <LoadingContainer animate>
      <div>{message}</div>
    </LoadingContainer>
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
  height: auto;
  font-size: ${p => p.theme.fontSize.md};
  color: ${p => p.theme.subText};
  z-index: 30;
  padding: 24px;
  background-color: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
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

export const TraceWaterfallState = {
  Loading: TraceLoading,
  Error: TraceError,
  Empty: TraceEmpty,
};
