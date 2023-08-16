import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import useOrganization from 'sentry/utils/useOrganization';

export function SampleDataAlert() {
  const user = ConfigStore.get('user');
  const {slug, isDynamicallySampled} = useOrganization();

  const {dismiss, isDismissed} = useDismissAlert({
    key: `${slug}-${user.id}:sample-data-alert-dismissed`,
  });

  if (isDismissed || !isDynamicallySampled) {
    return null;
  }

  return (
    <Alert type="warning" showIcon>
      <AlertContent>
        {t(
          'Based on your search criteria and sample rate, the events available may be limited because Discover uses sampled data only.'
        )}
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
  color: ${p => p.theme.alert.warning.iconColor};
  pointer-events: all;
  &:hover {
    color: ${p => p.theme.alert.warning.iconHoverColor};
    opacity: 0.5;
  }
`;

const AlertContent = styled('div')`
  display: grid;
  grid-template-columns: 1fr max-content;
  gap: ${space(1)};
  align-items: center;
`;
