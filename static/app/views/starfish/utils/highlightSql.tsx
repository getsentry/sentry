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
    } else if (KEYWORDS.has(acc)) {
      final = <Keyword key={i}>{acc}</Keyword>;
    } else if (['(', ')'].includes(acc)) {
      final = <Bracket key={i}>{acc}</Bracket>;
    } else if (token === ' ' || token === '\n' || description[i + 1] === ')') {
      final = acc;
    } else if (acc === '%s') {
      final = <Parameter>{acc}</Parameter>;
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

const KEYWORDS = new Set([
  'ADD',
  'ALL',
  'ALTER',
  'COLUMN',
  'TABLE',
  'AND',
  'ANY',
  'AS',
  'ASC',
  'BACKUP',
  'DATABASE',
  'BETWEEN',
  'CASE',
  'CHECK',
  'CONSTRAINT',
  'CREATE',
  'DATABASE',
  'DEFAULT',
  'DELETE',
  'DESC',
  'DISTINCT',
  'DROP',
  'EXEC',
  'EXISTS',
  'FOREIGN',
  'KEY',
  'FROM',
  'FULL',
  'OUTER',
  'INNER',
  'LEFT',
  'RIGHT',
  'ORDER',
  'ON',
  'LIMIT',
  'WHERE',
  'COUNT',
  'JOIN',
  'GROUP',
  'BY',
  'HAVING',
  'UPDATE',
]);

const Operation = styled('b')`
  color: ${p => p.theme.blue400};
`;

const Domain = styled('b')`
  color: ${p => p.theme.green400};
  margin-right: -${space(0.5)};
`;

const Parameter = styled('b')`
  color: ${p => p.theme.red400};
  margin-right: -${space(0.5)};
`;

const Keyword = styled('b')`
  color: ${p => p.theme.yellow400};
`;

const Bracket = styled('b')`
  color: ${p => p.theme.pink400};
`;
