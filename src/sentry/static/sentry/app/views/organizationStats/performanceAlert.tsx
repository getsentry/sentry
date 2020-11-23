import React from 'react';

import Feature from 'app/components/acl/feature';
import Alert from 'app/components/alert';
import {IconInfo} from 'app/icons';
import {t} from 'app/locale';

type Props = {message?: React.ReactNode};

const PerformanceAlert = ({message}: Props) => (
  <Feature features={['performance-view']}>
    <Alert type="info" icon={<IconInfo />} data-test-id="performance-usage">
      {message || t('Transactions and attachments are not yet included in the chart.')}
    </Alert>
  </Feature>
);

export default PerformanceAlert;
