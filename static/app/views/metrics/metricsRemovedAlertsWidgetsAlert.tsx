import styled from '@emotion/styled';

import type {Organization} from 'sentry/types/organization';

import Alert, {type AlertProps} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconClose} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';

const LOCAL_STORAGE_KEY = 'metrics-removed-alerts-wizards-info-dismissed';

export function MetricsRemovedAlertsWidgetsAlert({
  style,
  organization,
}: Pick<AlertProps, 'style'> & {organization: Organization}) {
  const {dismiss, isDismissed} = useDismissAlert({
    key: LOCAL_STORAGE_KEY,
    expirationDays: 365,
  });
  const hasDeletedAlertsOrWidgets = organization.features.includes(
    'custom-metrics-alerts-widgets-removal-info'
  );

  if (isDismissed || !hasDeletedAlertsOrWidgets) {
    return null;
  }

  return (
    <Alert type="info" showIcon style={style}>
      <AlertContent>
        <div>
          {tct(
            'The Metrics beta program has ended on October 7th and all alerts/dashboard widgets using custom metrics have been removed. For more details, please [link:read the FAQs]. Thank you again for participating.',
            {
              link: (
                <ExternalLink href="https://sentry.zendesk.com/hc/en-us/articles/26369339769883-Metrics-Beta-Coming-to-an-End" />
              ),
            }
          )}
        </div>
        <DismissButton
          priority="link"
          icon={<IconClose />}
          onClick={dismiss}
          aria-label={t('Dismiss Alert')}
          title={t('Dismiss Alert')}
        />
      </AlertContent>
    </Alert>
  );
}

const DismissButton = styled(Button)`
  color: ${p => p.theme.alert.warning.color};
  pointer-events: all;
  &:hover {
    opacity: 0.5;
  }
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
`;
