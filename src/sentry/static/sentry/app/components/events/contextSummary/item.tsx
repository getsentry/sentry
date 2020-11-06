import React from 'react';
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
  max-width: 100%;
  min-height: 48px;
`;

const Wrapper = styled('div')`
  border-top: 1px solid ${p => p.theme.gray300};
  padding: ${space(2)} 0 ${space(2)} 64px;
  display: flex;
  align-items: center;
  position: relative;
  min-height: 67px;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    border: 0;
    padding: ${space(0.5)} 0px 0px 64px;
    min-height: 48px;
  }
`;
