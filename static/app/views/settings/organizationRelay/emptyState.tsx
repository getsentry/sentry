import React from 'react';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

const EmptyState = () => (
  <Panel>
    <EmptyMessage>{t('No Keys Registered.')}</EmptyMessage>
  </Panel>
);

export default EmptyState;
