import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import space from 'sentry/styles/space';
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
          ({
            key,
            subject,
            value = null,
            meta,
            subjectIcon,
            subjectDataTestId,
            actionButton,
          }) => {
            return (
              <tr key={`${key}.${value}`}>
                <TableSubject className="key" wide={longKeys}>
                  {subject}
                </TableSubject>
                <td className="val" data-test-id={subjectDataTestId}>
                  {actionButton ? (
                    <ValueWithButtonContainer>
                      <Value
                        isContextData={isContextData}
                        meta={meta}
                        subjectIcon={subjectIcon}
                        value={value}
                        raw={raw}
                      />
                      <ActionButtonWrapper>{actionButton}</ActionButtonWrapper>
                    </ValueWithButtonContainer>
                  ) : (
                    <Value
                      isContextData={isContextData}
                      meta={meta}
                      subjectIcon={subjectIcon}
                      value={value}
                      raw={raw}
                    />
                  )}
                </td>
              </tr>
            );
          }
        )}
      </tbody>
    </table>
  );
}

export default KeyValueList;

const TableSubject = styled('td')<{wide?: boolean}>`
  @media (min-width: ${theme.breakpoints[2]}) {
    max-width: ${p => (p.wide ? '620px !important' : 'none')};
  }
`;

const ValueWithButtonContainer = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(1)};
  font-size: ${p => p.theme.fontSizeSmall};
  background: ${p => p.theme.bodyBackground};
  padding: ${space(1)} 10px;
  margin: ${space(0.25)} 0;
  pre {
    padding: 0 !important;
    margin: 0 !important;
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 1fr max-content;
  }
`;

const ActionButtonWrapper = styled('div')`
  height: 100%;
  display: flex;
  align-items: flex-start;
`;
