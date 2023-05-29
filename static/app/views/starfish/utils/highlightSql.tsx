import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export const highlightSql = (
  description: string,
  queryDetail: {action: string; domain: string}
) => {
  let acc = '';
  return description.split('').map((token, i) => {
    acc += token;
    let final: string | React.ReactElement | null = null;
    if (acc === queryDetail.action) {
      final = <Operation key={i}>{queryDetail.action} </Operation>;
    } else if (acc === queryDetail.domain) {
      final = <Domain key={i}>{queryDetail.domain} </Domain>;
    } else if (
      ['FROM', 'INNER', 'JOIN', 'WHERE', 'ON', 'AND', 'NOT', 'NULL', 'IS'].includes(acc)
    ) {
      final = <Keyword key={i}>{acc}</Keyword>;
    } else if (['(', ')'].includes(acc)) {
      final = <Bracket key={i}>{acc}</Bracket>;
    } else if (token === ' ' || token === '\n' || description[i + 1] === ')') {
      final = acc;
    } else if (i === description.length - 1) {
      final = acc;
    }
    if (final) {
      acc = '';
      const result = final;
      final = null;
      return result;
    }
    return null;
  });
};

const Operation = styled('b')`
  color: ${p => p.theme.blue400};
`;

const Domain = styled('b')`
  color: ${p => p.theme.green400};
  margin-right: -${space(0.5)};
`;

const Keyword = styled('b')`
  color: ${p => p.theme.yellow400};
`;

const Bracket = styled('b')`
  color: ${p => p.theme.pink400};
`;
