import React from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import ContextData from 'app/components/contextData';
import theme from 'app/utils/theme';

type Props = {
  /**
   * Data to render, could be almost anything as the various event interfaces
   * support all sorts of data.
   */
  data?: null | Record<string, any> | any[];
  /**
   * Whether or not the data should be rendered with ContextData
   */
  isContextData?: boolean;
  /**
   * Should the keys be sorted.
   */
  isSorted?: boolean;
  /**
   * Should the raw text be rendered.
   */
  raw?: boolean;
  /**
   * Enable wider rendering of the keys.
   */
  longKeys?: boolean;
  onClick?: (event: React.MouseEvent<HTMLElement>) => void;
};

/**
 * Generic KeyValue data renderer. The V2 version
 * of this component can also render annotations
 * for datascrubbing.
 */
function KeyValueList({
  data,
  onClick,
  isContextData = false,
  isSorted = true,
  raw = false,
  longKeys = false,
}: Props) {
  // TODO(dcramer): use non-string keys as reserved words ("unauthorized")
  // break rendering

  if (data === undefined || data === null) {
    data = [];
  } else if (!(data instanceof Array)) {
    data = Object.entries(data);
  } else {
    data = data.filter(kv => kv !== null);
  }

  data = isSorted ? sortBy(data, [([key]) => key]) : data;
  return (
    <table className="table key-value" onClick={onClick}>
      <tbody>
        {data.map(([key, value]) => {
          if (isContextData) {
            return [
              <tr key={key}>
                <TableData className="key" wide={longKeys}>
                  {key}
                </TableData>
                <td className="val">
                  <ContextData data={!raw ? value : JSON.stringify(value)} />
                </td>
              </tr>,
            ];
          } else {
            return [
              <tr key={key}>
                <TableData className="key" wide={longKeys}>
                  {key}
                </TableData>
                <td className="val">
                  <pre className="val-string">{'' + value || ' '}</pre>
                </td>
              </tr>,
            ];
          }
        })}
      </tbody>
    </table>
  );
}

const TableData = styled('td')<{wide: boolean}>`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : null)};
  }
`;

export default KeyValueList;
