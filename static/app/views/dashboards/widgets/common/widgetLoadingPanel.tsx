import styled from '@emotion/styled';

import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {X_GUTTER, Y_GUTTER} from 'sentry/views/dashboards/widgets/common/settings';

export function WidgetLoadingPanel({
  loadingMessage,
  expectMessage,
}: {
  // If we expect that a message will be provided, we can render a non-visible element that will
  // be replaced with the message to prevent layout shift.
  expectMessage?: boolean;
  loadingMessage?: string;
}) {
  return (
    <LoadingPlaceholder>
      <LoadingMask visible />
      <LoadingIndicator mini />
      {(expectMessage || loadingMessage) && (
        <LoadingMessage visible={Boolean(loadingMessage)}>
          {loadingMessage}
        </LoadingMessage>
      )}
    </LoadingPlaceholder>
  );
}

const LoadingPlaceholder = styled('div')`
  position: absolute;
  inset: 0;

  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  gap: ${p => p.theme.space.md};

  padding: ${Y_GUTTER} ${X_GUTTER};
`;

const LoadingMessage = styled('div')<{visible: boolean}>`
  opacity: ${p => (p.visible ? 1 : 0)};
  height: ${p => p.theme.font.size.sm};
`;

const LoadingMask = styled(TransparentLoadingMask)`
  background: ${p => p.theme.tokens.background.primary};
`;
