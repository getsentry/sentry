import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {ListItem} from 'app/components/list';

type Props = {
  title: React.ReactNode;
  children: React.ReactElement;
  subtitle?: React.ReactNode;
};

const Item = ({title, subtitle, children}: Props) => (
  <StyledListItem>
    {title}
    {subtitle && <small>{subtitle}</small>}
    <div>{children}</div>
  </StyledListItem>
);

export default Item;

const StyledListItem = styled(ListItem)`
  display: grid;
  grid-gap: ${space(1.5)};
`;
