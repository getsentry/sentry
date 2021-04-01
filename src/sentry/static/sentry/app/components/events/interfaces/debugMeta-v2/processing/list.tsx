import React from 'react';
import styled from '@emotion/styled';

import NotAvailable from 'app/components/notAvailable';
import {t} from 'app/locale';

type Props = {
  items: Array<React.ReactElement>;
  className?: string;
};

function List({items, className}: Props) {
  if (!items.length) {
    return <NotAvailable tooltip={t('Processing info not available')} />;
  }

  return <Wrapper className={className}>{items}</Wrapper>;
}

export default List;

const Wrapper = styled('div')`
  display: flex;
  flex-wrap: wrap;
  font-size: ${p => p.theme.fontSizeSmall};
`;
