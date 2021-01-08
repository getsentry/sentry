import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import NotAvailable from '../notAvailable';

type Props = {
  items: Array<React.ReactElement>;
};

function List({items}: Props) {
  if (!items.length) {
    return <NotAvailable />;
  }

  return <Wrapper>{items}</Wrapper>;
}

export default List;

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-column-gap: ${space(2)};
  font-size: ${p => p.theme.fontSizeSmall};
`;
