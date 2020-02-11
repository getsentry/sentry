import React from 'react';
import sortBy from 'lodash/sortBy';
import styled from '@emotion/styled';

import ContextData from 'app/components/contextData';
import theme from 'app/utils/theme';

type Props = {
  data?: Array<KeyValueListData>;
  onClick?: () => void;
  raw?: boolean;
  longKeys?: boolean;
  isContextData?: boolean;
  isSorted?: boolean;
};

export type KeyValueListData = {
  key: string;
  subject: React.ReactNode;
  value: string | null;
  meta: Meta;
};

type Meta = {
  chunks: Array<Chunks>;
  len: number;
  rem: Array<Array<string | number>>;
};

type Chunks = {
  text: string;
  type: string;
  remark?: string;
  rule_id?: string;
};

const KeyValueList = ({
  data,
  isContextData = false,
  isSorted = true,
  raw = false,
  longKeys = false,
  onClick,
}: Props) => {
  if (data === undefined || data === null || data.length === 0) {
    return null;
  }

  const getData = () => {
    if (isSorted) {
      return sortBy(data, [({subject}) => subject]);
    }
    return data;
  };

  return (
    <table className="table key-value" onClick={onClick}>
      <tbody>
        {getData().map(({key, subject, value, meta}) => (
          <tr key={key}>
            <TableData className="key" wide={longKeys}>
              {subject}
            </TableData>
            <td className="val">
              {isContextData ? (
                <ContextData
                  data={!raw ? value : JSON.stringify(value)}
                  meta={meta}
                  withAnnotatedText
                />
              ) : (
                <pre className="val-string">{String(value)}</pre>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

const TableData = styled('td')<{wide?: boolean}>`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : null)};
  }
`;

KeyValueList.displayName = 'KeyValueList';

export default KeyValueList;
