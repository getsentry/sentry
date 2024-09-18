import styled from '@emotion/styled';

import Alert from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const DASHBOARD_SPLIT_ALERT_DISMISSED_KEY = 'dashboard-discover-split-alert-dismissed';

interface DiscoverSplitAlertProps {
  dashboardId: string;
  hasForcedWidgets: boolean;
}

export function DiscoverSplitAlert({
  hasForcedWidgets,
  dashboardId,
}: DiscoverSplitAlertProps) {
  const {isDismissed, dismiss} = useDismissAlert({
    key: `${DASHBOARD_SPLIT_ALERT_DISMISSED_KEY}-${dashboardId}`,
  });

  if (!hasForcedWidgets || isDismissed) {
    return null;
  }

  return (
    <Alert
      type="warning"
      showIcon
      trailingItems={
        <StyledCloseButton
          icon={<IconClose size="sm" />}
          aria-label={t('Close')}
          onClick={dismiss}
          size="zero"
          borderless
        />
      }
    >
      {t(
        "We're splitting our Errors and Transactions dataset up to make it a bit easier to digest. Some of your widgets have been defaulted to the Errors dataset. If this is incorrect you can change the dataset by editing the widget."
      )}
    </Alert>
  );
}

const StyledCloseButton = styled(Button)`
  background-color: transparent;
  transition: opacity 0.1s linear;

  &:hover,
  &:focus {
    background-color: transparent;
    opacity: 1;
  }
`;
