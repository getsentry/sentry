import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import EmptyMessage from 'sentry/views/settings/components/emptyMessage';

const EmptyState = () => (
  <Panel>
    <EmptyMessage>{t('No Keys Registered.')}</EmptyMessage>
  </Panel>
);

export default EmptyState;
