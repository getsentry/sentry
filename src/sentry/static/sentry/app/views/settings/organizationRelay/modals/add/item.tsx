import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import {ListItem} from 'app/components/list';

type Props = {
  title: React.ReactNode;
  content: React.ReactElement;
  subtitle?: React.ReactNode;
  /**
   * The position of the step.
   * The prop defaults to the value inherited from the parent Steps component.
   */
  index?: number;
};

const Item = ({title, subtitle, content, index}: Props) => (
  <StyledListItem>
    {index !== undefined && <Bullet>{index}</Bullet>}
    <Content>
      <div>{title}</div>
      {subtitle && <small>{subtitle}</small>}
      {content}
    </Content>
  </StyledListItem>
);

export default Item;

const StyledListItem = styled(ListItem)`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(1.5)};
`;

const Bullet = styled('div')`
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: ${p => p.theme.yellow400};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Content = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
`;
