import EmptyMessage from 'sentry/components/emptyMessage';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';

const EmptyState = () => (
  <Panel>
    <EmptyMessage>{t('No Keys Registered.')}</EmptyMessage>
  </Panel>
);

export default EmptyState;
