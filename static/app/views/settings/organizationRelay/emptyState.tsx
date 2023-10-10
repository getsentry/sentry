import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';

function EmptyState() {
  return (
    <Panel>
      <EmptyMessage>{t('No Keys Registered.')}</EmptyMessage>
    </Panel>
  );
}

export default EmptyState;
