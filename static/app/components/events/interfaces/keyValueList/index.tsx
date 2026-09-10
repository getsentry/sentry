import {Fragment} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';
import sortBy from 'lodash/sortBy';

import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {ValueLink} from 'sentry/components/keyValueData';
import type {KeyValueListData} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import type {ValueProps} from './value';
import {Value} from './value';

interface Props extends Pick<ValueProps, 'raw' | 'isContextData'> {
  className?: string;
  data?: KeyValueListData;
  shouldSort?: boolean;
}

export function KeyValueList({
  data,
  isContextData = false,
  shouldSort = true,
  raw = false,
  className,
  ...props
}: Props) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const keyValueData = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Container containerType="inline-size">
      <Table className={classNames('table key-value', className)} {...props}>
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
                  <td className="key">{subject}</td>
                  <td className="val" data-test-id={subjectDataTestId}>
                    <Tablevalue>
                      {actionButton ? (
                        <Grid align="center" columns="1fr max-content" gap="md">
                          {({className: gridClassName}) => (
                            <ValueWithButtonContainer className={gridClassName}>
                              {valueContainer}
                              <Flex align="start" height="100%">
                                {actionButton}
                              </Flex>
                            </ValueWithButtonContainer>
                          )}
                        </Grid>
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
    </Container>
  );
}

function MultiValueContainer({values}: {values: string[]}): React.JSX.Element {
  return (
    <Fragment>
      {values.map((val, idx) => (
        <Value key={`${val}-${idx}`} value={val} />
      ))}
    </Fragment>
  );
}

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
  font-size: ${p => p.theme.font.size.sm};
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.md} 10px;
  margin: ${p => p.theme.space['2xs']} 0;
  border-radius: ${p => p.theme.radius.md};
  pre {
    padding: 0 !important;
    margin: 0 !important;
  }
`;

const Table = styled('table')`
  @container (max-width: ${p => p.theme.container.sm}) {
    &,
    > tbody,
    > tbody > tr,
    > tbody > tr > td {
      display: block;
      width: 100%;
      max-width: none;
    }

    > tbody > tr > td.key {
      width: auto;
      max-width: none;
      padding-bottom: 0 !important;
    }
  }

  > * pre > pre {
    margin: 0 !important;
    padding: 0 !important;
  }
`;
