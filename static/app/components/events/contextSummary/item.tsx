import * as React from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import space from 'app/styles/space';

type Props = {
  icon: React.ReactElement;
  children: React.ReactNode;
  className?: string;
};

const Item = ({children, icon, className}: Props) => (
  <Wrapper className={classNames('context-item', className)}>
    {icon}
    {children && <Details>{children}</Details>}
  </Wrapper>
);

export default Item;

const Details = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: center;
  max-width: 100%;
  min-height: 48px;
`;

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.innerBorder};
  padding: 4px 0 4px 40px;
  display: flex;
  margin-right: ${space(3)};
  align-items: center;
  position: relative;
  min-width: 0;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    max-width: 25%;
    border: 0;
    padding: 0px 0px 0px 42px;
  }
`;
