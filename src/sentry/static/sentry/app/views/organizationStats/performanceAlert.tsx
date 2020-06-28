import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {IconInfo} from 'app/icons';
import Alert from 'app/components/alert';
import Feature from 'app/components/acl/feature';

type Props = {message?: React.ReactNode};

const PerformanceAlert = ({message}: Props) => (
  <Feature features={['performance-view']}>
    <AlertContainer>
      <Alert type="info" icon={<IconInfo />} data-test-id="performance-usage">
        {message || t('Transactions and attachments are not yet included in the chart.')}
      </Alert>
    </AlertContainer>
  </Feature>
);

const AlertContainer = styled('div')`
  display: grid;
  grid-auto-columns: max-content;
`;

export default PerformanceAlert;
