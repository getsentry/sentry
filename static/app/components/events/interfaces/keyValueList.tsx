import {isValidElement} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import ContextData from 'sentry/components/contextData';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {KeyValueListData} from 'sentry/types';
import {defined} from 'sentry/utils';
import theme from 'sentry/utils/theme';

type Props = {
  data?: KeyValueListData;
  isContextData?: boolean;
  isSorted?: boolean;
  longKeys?: boolean;
  onClick?: () => void;
  raw?: boolean;
};

const KeyValueList = ({
  data,
  isContextData = false,
  isSorted = true,
  raw = false,
  longKeys = false,
  onClick,
}: Props) => {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const getData = () => {
    if (isSorted) {
      return sortBy(data, [({key}) => key.toLowerCase()]);
    }
    return data;
  };

  return (
    <table className="table key-value" onClick={onClick}>
      <tbody>
        {getData().map(
          ({key, subject, value = null, meta, subjectIcon, subjectDataTestId}) => {
            const dataValue: React.ReactNode =
              typeof value === 'object' && !isValidElement(value)
                ? JSON.stringify(value, null, 2)
                : value;

            let contentComponent: React.ReactNode = (
              <pre className="val-string">
                <AnnotatedText value={dataValue} meta={meta} />
                {subjectIcon}
              </pre>
            );

            if (isContextData) {
              contentComponent = (
                <ContextData
                  data={!raw ? value : JSON.stringify(value)}
                  meta={meta}
                  withAnnotatedText
                >
                  {subjectIcon}
                </ContextData>
              );
            } else if (typeof dataValue !== 'string' && isValidElement(dataValue)) {
              contentComponent = dataValue;
            }

            return (
              <tr key={`${key}.${value}`}>
                <TableSubject className="key" wide={longKeys}>
                  {subject}
                </TableSubject>
                <td className="val" data-test-id={subjectDataTestId}>
                  {contentComponent}
                </td>
              </tr>
            );
          }
        )}
      </tbody>
    </table>
  );
};

const TableSubject = styled('td')<{wide?: boolean}>`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : 'none')};
  }
`;

KeyValueList.displayName = 'KeyValueList';

export default KeyValueList;
