import {Children, cloneElement, isValidElement} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {getListSymbolStyle, listSymbol} from './utils';

type Props = {
  children: React.ReactNode;
  className?: string;
  'data-test-id'?: string;
  initialCounterValue?: number;
  symbol?: keyof typeof listSymbol | React.ReactElement;
};

const List = styled(
  ({
    children,
    className,
    symbol,
    initialCounterValue: _initialCounterValue,
    ...props
  }: Props) => {
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
          : Children.map(children, child => {
              if (!isValidElement(child)) {
                return child;
              }
              return cloneElement(child as React.ReactElement, {
                symbol,
              });
            })}
      </Wrapper>
    );
  }
)`
  margin: 0;
  padding: 0;
  list-style: none;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space(0.5)};
  ${p =>
    typeof p.symbol === 'string' &&
    listSymbol[p.symbol] &&
    getListSymbolStyle(p.theme, p.symbol, p.initialCounterValue)}
`;

export default List;
