import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';
import theme from 'sentry/utils/theme';

import {Value, ValueProps} from './value';

interface Props extends Pick<ValueProps, 'raw' | 'isContextData'> {
  data?: KeyValueListData;
  isSorted?: boolean;
  longKeys?: boolean;
  onClick?: () => void;
}

function KeyValueList({
  data,
  isContextData = false,
  isSorted = true,
  raw = false,
  longKeys = false,
  onClick,
}: Props) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const keyValueData = isSorted ? sortBy(data, [({key}) => key.toLowerCase()]) : data;

  return (
    <table className="table key-value" onClick={onClick}>
      <tbody>
        {keyValueData.map(
          ({key, subject, value = null, meta, subjectIcon, subjectDataTestId}) => {
            return (
              <tr key={`${key}.${value}`}>
                <TableSubject className="key" wide={longKeys}>
                  {subject}
                </TableSubject>
                <td className="val" data-test-id={subjectDataTestId}>
                  <Value
                    isContextData={isContextData}
                    meta={meta}
                    subjectIcon={subjectIcon}
                    value={value}
                    raw={raw}
                  />
                </td>
              </tr>
            );
          }
        )}
      </tbody>
    </table>
  );
}

const TableSubject = styled('td')<{wide?: boolean}>`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : 'none')};
  }
`;

export default KeyValueList;
