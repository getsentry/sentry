import type React from 'react';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconClose, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Color} from 'sentry/utils/theme';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const EXTRAPOLATED_AREA_STRIPE_IMG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAABkAQMAAACFAjPUAAAAAXNSR0IB2cksfwAAAAlwSFlzAAALEwAACxMBAJqcGAAAAAZQTFRFpKy5SVlzL3npZAAAAA9JREFUeJxjsD/AMIqIQwBIyGOd43jaDwAAAABJRU5ErkJggg==';

export const extrapolatedAreaStyle = {
  color: {
    repeat: 'repeat',
    image: EXTRAPOLATED_AREA_STRIPE_IMG,
    rotation: 0.785,
    scaleX: 0.5,
  },
  opacity: 1.0,
};

export function OnDemandWarningIcon({
  msg,
  isHoverable,
  color = 'gray300',
}: {
  msg: React.ReactNode;
  color?: Color;
  isHoverable?: boolean;
}) {
  return (
    <Tooltip skipWrapper title={msg} isHoverable={isHoverable}>
      <HoverableIconWarning color={color} />
    </Tooltip>
  );
}

const LOCAL_STORAGE_KEY = 'on-demand-empty-alert-dismissed';

export function OnDemandMetricAlert({
  message,
  dismissable = false,
}: {
  message: React.ReactNode;
  dismissable?: boolean;
}) {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});

  if (dismissable && isDismissed) {
    return null;
  }

  return (
    <Alert.Container>
      <InfoAlert type="info" showIcon>
        {message}
        {dismissable && (
          <DismissButton
            priority="link"
            size="sm"
            icon={<IconClose />}
            aria-label={t('Close Alert')}
            onClick={dismiss}
          />
        )}
      </InfoAlert>
    </Alert.Container>
  );
}

// @TODO(jonasbadalic): Why cant this just be Alert type=info?
const InfoAlert = styled(Alert)`
  display: flex;
  align-items: flex-start;

  & > span {
    display: flex;
    flex-grow: 1;
    justify-content: space-between;

    line-height: 1.5em;
  }
`;

const DismissButton = styled(Button)`
  pointer-events: all;
  &:hover {
    opacity: 0.5;
  }
`;

const HoverableIconWarning = styled(IconWarning)`
  min-width: ${p => p.theme.iconSizes.sm};
  &:hover {
    cursor: pointer;
  }
`;
