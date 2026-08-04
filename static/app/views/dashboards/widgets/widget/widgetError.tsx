import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {DEEMPHASIS_VARIANT} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import type {
  ErrorPropWithResponseJSON,
  StateProps,
} from 'sentry/views/dashboards/widgets/common/types';

interface WidgetErrorProps {
  error: StateProps['error'];
  /**
   * Optional content rendered beneath the error message, e.g. a button that
   * lets the user retry or send feedback.
   */
  action?: React.ReactNode;
}

export function WidgetError({error, action}: WidgetErrorProps) {
  return (
    <Panel>
      <NonShrinkingWarningIcon variant={DEEMPHASIS_VARIANT} size="md" />
      <Stack align="start" gap="md">
        <ErrorText>
          {typeof error === 'string'
            ? error
            : ((error as ErrorPropWithResponseJSON)?.responseJSON?.detail?.toString() ??
              error?.message ??
              t('Error loading data.'))}
        </ErrorText>
        {action}
      </Stack>
    </Panel>
  );
}

const Panel = styled('div')`
  container-type: inline-size;
  container-name: error-panel;

  padding: ${p => p.theme.space.lg} ${p => p.theme.space.xl};

  display: flex;
  gap: ${p => p.theme.space.md};

  overflow: hidden;

  color: ${p => p.theme.tokens.content[DEEMPHASIS_VARIANT]};
`;

const NonShrinkingWarningIcon = styled(IconWarning)`
  flex-shrink: 0;
`;

const ErrorText = styled('span')`
  font-size: ${p => p.theme.font.size.sm};

  @container error-panel (min-width: 360px) {
    font-size: ${p => p.theme.font.size.md};
  }
`;
