import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Link} from 'sentry/components/core/link';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useLocation} from 'sentry/utils/useLocation';

interface SeerAutomationAlertProps {
  organization: Organization;
}

export default function SeerAutomationAlert({organization}: SeerAutomationAlertProps) {
  const location = useLocation();
  const isRedirectedFromCheckout = !!location.query.showSeerAutomationAlert;

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${organization.id}:seer-automation-billing-alert`,
  });

  if (
    isDismissed ||
    !organization.features.includes('seer-added') ||
    !isRedirectedFromCheckout
  ) {
    return null;
  }

  return (
    <Alert.Container>
      <Alert
        variant="info"
        trailingItems={
          <Button
            icon={<IconClose />}
            onClick={dismiss}
            size="zero"
            borderless
            aria-label={t('Dismiss banner')}
          />
        }
      >
        <Stack gap="xs">
          <AlertHeader>
            {t('Seer issue scans and fixes run automatically at low settings by default')}
          </AlertHeader>
          <div>
            {t(
              'You can configure how these work across all of your projects, including the threshold. Changing the threshold will affect how often they run and may impact your bill.'
            )}
          </div>
          <Link to={`/settings/${organization.slug}/seer/`}>
            {t('Manage Seer Automation Settings')}
          </Link>
        </Stack>
      </Alert>
    </Alert.Container>
  );
}

const AlertHeader = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
  font-size: ${p => p.theme.fontSize.lg};
`;
