import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import NotAvailable from '../notAvailable';

type Props = {
  items: Array<React.ReactElement>;
  className?: string;
};

function List({items, className}: Props) {
  if (!items.length) {
    return <NotAvailable />;
  }

  return <Wrapper className={className}>{items}</Wrapper>;
}

export default List;

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
