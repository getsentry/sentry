import styled from '@emotion/styled';

import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useDismissAlert from 'sentry/utils/useDismissAlert';
import {useTogglePreferedAiModule} from 'sentry/views/insights/agentMonitoring/utils/features';

const LOCAL_STORAGE_KEY = 'llm-monitoring-info-alert-dismissed';

export function LegacyLLMMonitoringInfoAlert() {
  const {dismiss, isDismissed} = useDismissAlert({key: LOCAL_STORAGE_KEY});
  const [_, togglePreferedModule] = useTogglePreferedAiModule();

  const handleSwitchUI = () => {
    dismiss();
    togglePreferedModule();
  };

  if (isDismissed) {
    return null;
  }

  return (
    <StyledAlert
      type="info"
      showIcon
      trailingItems={
        <Button
          priority="link"
          size="sm"
          icon={<IconClose />}
          onClick={dismiss}
          aria-label={t('Close Alert')}
          borderless
        />
      }
    >
      <Message>
        {t('Looking for the old LLM Monitoring Experience?')}
        <Button size="xs" priority="primary" onClick={handleSwitchUI}>
          {t('Switch UI')}
        </Button>
      </Message>
    </StyledAlert>
  );
}

const StyledAlert = styled(Alert)`
  margin-bottom: ${space(2)};
`;

const Message = styled('span')`
  display: flex;
  flex-grow: 1;
  gap: ${space(1)};
  align-items: center;
`;
