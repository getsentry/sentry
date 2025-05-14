import {Button} from 'sentry/components/core/button';
import {IconSettings} from 'sentry/icons';
import {t} from 'sentry/locale';

// TODO(miahsu): Implement the action settings button/modal
export default function TicketActionSettingsButton() {
  return (
    <Button size="sm" icon={<IconSettings />}>
      {t('Action Settings')}
    </Button>
  );
}
