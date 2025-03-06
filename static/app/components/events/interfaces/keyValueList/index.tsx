import {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import sortBy from 'lodash/sortBy';

import {ValueLink} from 'sentry/components/keyValueData';
import {space} from 'sentry/styles/space';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils';

import type {ValueProps} from './value';
import {Value} from './value';

interface Props extends Pick<ValueProps, 'raw' | 'isContextData'> {
  className?: string;
  data?: KeyValueListData;
  longKeys?: boolean;
  onClick?: () => void;
  shouldSort?: boolean;
}

function KeyValueList({
  data,
  isContextData = false,
  shouldSort = true,
  raw = false,
  longKeys = false,
  onClick,
  className,
  ...props
}: Props) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const keyValueData = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Table
      className={classNames('table key-value', className)}
      onClick={onClick}
      {...props}
    >
      <tbody>
        {keyValueData.map(
          (
            {
              key,
              subject,
              value = null,
              meta,
              subjectIcon,
              subjectDataTestId,
              action,
              actionButton,
              isContextData: valueIsContextData,
              isMultiValue,
            },
            idx
          ) => {
            const valueProps = {
              isContextData: valueIsContextData || isContextData,
              meta,
              subjectIcon,
              value,
              raw,
            };

            const valueItem = action?.link ? (
              <ValueLink to={action.link}>{<Value {...valueProps} />}</ValueLink>
            ) : (
              <Value {...valueProps} />
            );

            const valueContainer =
              isMultiValue && Array.isArray(value) ? (
                <MultiValueContainer values={value} />
              ) : (
                valueItem
              );

            return (
              <tr key={`${key}-${idx}`}>
                <TableSubject className="key" wide={longKeys}>
                  {subject}
                </TableSubject>
                <td className="val" data-test-id={subjectDataTestId}>
                  <Tablevalue>
                    {actionButton ? (
                      <ValueWithButtonContainer>
                        {valueContainer}
                        <ActionButtonWrapper>{actionButton}</ActionButtonWrapper>
                      </ValueWithButtonContainer>
                    ) : (
                      valueContainer
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

function MultiValueContainer({values}: {values: string[]}): JSX.Element {
  return (
    <Fragment>
      {values.map((val, idx) => (
        <Value key={`${val}-${idx}`} value={val} />
      ))}
    </Fragment>
  );
}

export default KeyValueList;

const TableSubject = styled('td')<{wide?: boolean}>`
  @media (min-width: ${p => p.theme.breakpoints.large}) {
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
  border-radius: ${p => p.theme.borderRadius};
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
