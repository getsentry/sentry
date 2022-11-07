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
  ...props
}: Props) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const keyValueData = isSorted ? sortBy(data, [({key}) => key.toLowerCase()]) : data;

  return (
    <Table className="table key-value" onClick={onClick} {...props}>
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
            isContextData: valueIsContextData,
          }) => {
            const valueProps = {
              isContextData: valueIsContextData || isContextData,
              meta,
              subjectIcon,
              value,
              raw,
            };

            return (
              <tr key={`${key}.${value}`}>
                <TableSubject className="key" wide={longKeys}>
                  {subject}
                </TableSubject>
                <td className="val" data-test-id={subjectDataTestId}>
                  <Tablevalue id={key}>
                    {actionButton ? (
                      <ValueWithButtonContainer>
                        <Value {...valueProps} />
                        <ActionButtonWrapper>{actionButton}</ActionButtonWrapper>
                      </ValueWithButtonContainer>
                    ) : (
                      <Value {...valueProps} />
                    )}
                  </Tablevalue>
                </td>
              </tr>
            );
          }
        )}
      </tbody>
    </Table>
  );
}

export default KeyValueList;

const TableSubject = styled('td')<{wide?: boolean}>`
  @media (min-width: ${theme.breakpoints.large}) {
    max-width: ${p => (p.wide ? '620px !important' : 'none')};
  }
`;

const Tablevalue = styled('div')`
  pre {
    && {
      word-break: break-all;
    }
  }
  pre > pre {
    display: inline-block;
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

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 1fr max-content;
  }
`;

const ActionButtonWrapper = styled('div')`
  height: 100%;
  display: flex;
  align-items: flex-start;
`;

const Table = styled('table')`
  > * pre > pre {
    margin: 0 !important;
    padding: 0 !important;
  }
`;
