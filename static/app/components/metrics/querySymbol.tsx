import {forwardRef} from 'react';

import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

import {_Symbol, QueryInputGroup} from './queryInputGroup';

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

export const Symbol = _Symbol;
interface QuerySymbolProps extends React.ComponentProps<typeof Symbol> {
  queryId: number;
}

export const QuerySymbol = forwardRef<HTMLSpanElement, QuerySymbolProps>(
  function QuerySymbol({queryId, ...props}, ref) {
    const organization = useOrganization();

    if (queryId < 0) {
      return null;
    }

    const Component = hasMetricsNewInputs(organization) ? QueryInputGroup.Symbol : Symbol;

    return (
      <Component ref={ref} {...props}>
        <span>{getQuerySymbol(queryId)}</span>
      </Component>
    );
  }
);
