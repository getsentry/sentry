import styled from '@emotion/styled';

import {IconWarning} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {DEEMPHASIS_COLOR_NAME} from 'sentry/views/dashboards/widgets/bigNumberWidget/settings';
import type {StateProps} from 'sentry/views/dashboards/widgets/common/types';

interface ErrorPanelProps {
  error: StateProps['error'];
}

export function ErrorPanel({error}: ErrorPanelProps) {
  return (
    <Panel>
      <NonShrinkingWarningIcon color={DEEMPHASIS_COLOR_NAME} size="md" />
      <span>{error?.toString()}</span>
    </Panel>
  );
}

const NonShrinkingWarningIcon = styled(IconWarning)`
  flex-shrink: 0;
`;

const Panel = styled('div')<{height?: string}>`
  position: absolute;
  inset: 0;

  padding: ${space(0.5)} 0;

  display: flex;
  gap: ${space(1)};

  overflow: hidden;

  color: ${p => p.theme[DEEMPHASIS_COLOR_NAME]};
  font-size: ${p => p.theme.fontSizeLarge};
`;
