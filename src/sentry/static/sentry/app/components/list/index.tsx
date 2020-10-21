import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';

import {getListSymbolStyle, listSymbol} from './utils';

type Props = {
  children: Array<React.ReactElement>;
  symbol?: keyof typeof listSymbol | React.ReactElement;
  className?: string;
};

const List = styled(({children, className, symbol, ...props}: Props) => {
  const getWrapperComponent = () => {
    switch (symbol) {
      case 'numeric':
      case 'colored-numeric':
        return 'ol';
      default:
        return 'ul';
    }
  };

  const Wrapper = getWrapperComponent();

  return (
    <Wrapper className={className} {...props}>
      {!symbol || typeof symbol === 'string'
        ? children
        : React.Children.map(children, child => {
            if (!React.isValidElement(child)) {
              return child;
            }
            return React.cloneElement(child as React.ReactElement, {
              symbol,
            });
          })}
    </Wrapper>
  );
})`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-gap: ${space(0.5)};
  ${p =>
    typeof p.symbol === 'string' &&
    listSymbol[p.symbol] &&
    getListSymbolStyle(p.theme, p.symbol)}
`;

export default List;
