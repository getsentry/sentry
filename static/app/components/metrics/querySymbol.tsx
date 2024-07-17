import {forwardRef} from 'react';

import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

import {QueryInputGroup} from './queryInputGroup';
import {DeprecatedSymbol} from './styles';

const indexToChar = 'abcdefghijklmnopqrstuvwxyz';

export const getQuerySymbol = (index: number) => {
  let result = '';
  let i = index;
  do {
    result = indexToChar[i % indexToChar.length] + result;
    i = Math.floor(i / indexToChar.length) - 1;
  } while (i >= 0);
  return result;
};

interface QuerySymbolProps extends React.ComponentProps<typeof DeprecatedSymbol> {
  queryId: number;
}

export const QuerySymbol = forwardRef<HTMLSpanElement, QuerySymbolProps>(
  function QuerySymbol({queryId, ...props}, ref) {
    const organization = useOrganization();

    if (queryId < 0) {
      return null;
    }

    const Component = hasMetricsNewInputs(organization)
      ? QueryInputGroup.Symbol
      : DeprecatedSymbol;

    return (
      <Component ref={ref} {...props}>
        <span>{getQuerySymbol(queryId)}</span>
      </Component>
    );
  }
);
