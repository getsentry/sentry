import styled from '@emotion/styled';

import loadingGif from 'sentry-images/spot/ai-loader.gif';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useMedia from 'sentry/utils/useMedia';

interface Props {
  message?: string;
}

/**
 * Loading animation for the AI replay summary.
 * Shows a static LoadingIndicator when the user prefers reduced motion,
 * otherwise shows the animated GIF.
 */
export function ReplayAiLoading({message}: Props) {
  const prefersReducedMotion = useMedia('(prefers-reduced-motion: reduce)');

  if (prefersReducedMotion) {
    return (
      <LoadingContainer>
        <LoadingIndicator size={64} />
        {message && <LoadingMessage>{message}</LoadingMessage>}
      </LoadingContainer>
    );
  }

  return (
    <LoadingContainer>
      <AnimationImage src={loadingGif} alt={t('Loading...')} />
      {message && <LoadingMessage>{message}</LoadingMessage>}
    </LoadingContainer>
  );
}

const LoadingContainer = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  padding: ${space(4)};
  overflow: auto;
  text-align: center;
  gap: ${space(2)};
`;

const AnimationImage = styled('img')`
  max-height: 400px;
`;

const LoadingMessage = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
