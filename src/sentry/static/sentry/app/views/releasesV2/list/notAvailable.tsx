import React from 'react';
import styled from '@emotion/styled';

import {t} from 'app/locale';

const NotAvailable = () => {
  return <Wrapper>{t('n/a')}</Wrapper>;
};

const Wrapper = styled('div')`
  color: ${p => p.theme.gray1};
`;

export default NotAvailable;
