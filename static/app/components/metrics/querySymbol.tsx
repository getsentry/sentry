import {forwardRef} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import {hasMetricsNewInputs} from 'sentry/utils/metrics/features';
import useOrganization from 'sentry/utils/useOrganization';

const indexToChar = 'abcdefghijklmnopqrstuvwxyz';

export const getQuerySymbol = (index: number, uppercaseChar?: boolean) => {
  let result = '';
  let i = index;
  do {
    result = indexToChar[i % indexToChar.length] + result;
    i = Math.floor(i / indexToChar.length) - 1;
  } while (i >= 0);
  return uppercaseChar ? result.toUpperCase() : result;
};

export const DeprecatedSymbol = styled('span')<{
  isHidden?: boolean;
}>`
  display: flex;
  width: 38px;
  height: 38px;
  line-height: 16px;
  padding: ${space(0.5)};
  justify-content: center;
  align-items: center;
  flex-shrink: 0;
  border-radius: ${p => p.theme.borderRadius};
  ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.white};
  font-size: 14px;
  background: ${p => p.theme.purple300};
  ${p =>
    p.isHidden &&
    `
  background: ${p.theme.background};
  color: ${p.theme.textColor};
  border: 1px solid ${p.theme.border};
  `}
`;

export const Symbol = styled(DeprecatedSymbol)`
  color: ${p => p.theme.purple300};
  border: 1px solid ${p => p.theme.purple200};
  background: ${p => p.theme.purple100};
  font-weight: 600;
  ${p => p.isHidden && 'opacity: 0.5;'}
`;

interface QuerySymbolProps extends React.ComponentProps<typeof Symbol> {
  queryId: number;
}

export const QuerySymbol = forwardRef<HTMLSpanElement, QuerySymbolProps>(
  function QuerySymbol({queryId, ...props}, ref) {
    const organization = useOrganization();

    if (queryId < 0) {
      return null;
    }

    if (hasMetricsNewInputs(organization)) {
      return (
        <Symbol ref={ref} {...props}>
          <span>{getQuerySymbol(queryId, true)}</span>
        </Symbol>
      );
    }

    return (
      <DeprecatedSymbol ref={ref} {...props}>
        <span>{getQuerySymbol(queryId, false)}</span>
      </DeprecatedSymbol>
    );
  }
);
