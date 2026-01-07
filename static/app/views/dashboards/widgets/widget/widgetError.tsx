import styled from '@emotion/styled';

import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DEEMPHASIS_VARIANT} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import {X_GUTTER, Y_GUTTER} from 'sentry/views/dashboards/widgets/common/settings';
import type {
  ErrorPropWithResponseJSON,
  StateProps,
} from 'sentry/views/dashboards/widgets/common/types';

interface WidgetErrorProps {
  error: StateProps['error'];
}

export function WidgetError({error}: WidgetErrorProps) {
  return (
    <Panel>
      <NonShrinkingWarningIcon variant={DEEMPHASIS_VARIANT} size="md" />
      <ErrorText>
        {typeof error === 'string'
          ? error
          : ((error as ErrorPropWithResponseJSON)?.responseJSON?.detail.toString() ??
            error?.message ??
            t('Error loading data.'))}
      </ErrorText>
    </Panel>
  );
}

const Panel = styled('div')<{height?: string}>`
  container-type: size;
  container-name: error-panel;

  position: absolute;
  inset: 0;

  padding: ${Y_GUTTER} ${X_GUTTER};

  display: flex;
  gap: ${space(1)};

  overflow: hidden;

  color: ${p => p.theme.tokens.content[DEEMPHASIS_VARIANT]};
`;

const NonShrinkingWarningIcon = styled(IconWarning)`
  flex-shrink: 0;
`;

const ErrorText = styled('span')`
  font-size: ${p => p.theme.fontSize.sm};

  @container error-panel (min-width: 360px) {
    font-size: ${p => p.theme.fontSize.md};
  }
`;
