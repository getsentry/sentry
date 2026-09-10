import {Fragment} from 'react';
import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

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
    <Grid
      className={className}
      columns={{zero: 'minmax(0, 1fr)', sm: '175px minmax(0, 500px)'}}
      gap="md"
      role="table"
      width="100%"
      {...props}
    >
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
            <Grid
              align="start"
              column="1 / -1"
              columns="subgrid"
              gap="md lg"
              key={`${key}-${idx}`}
              role="row"
            >
              <Container role="cell">
                <Text bold density="comfortable" wordBreak="break-word">
                  {subject}
                </Text>
              </Container>
              <Container
                className="val"
                data-test-id={subjectDataTestId}
                minWidth="0"
                role="cell"
              >
                <Tablevalue>
                  {actionButton ? (
                    <ValueWithActionButton>
                      {valueContainer}
                      <Flex align="start" height="100%">
                        {actionButton}
                      </Flex>
                    </ValueWithActionButton>
                  ) : (
                    valueContainer
                  )}
                </Tablevalue>
              </Container>
            </Grid>
          );
        }
      )}
    </Grid>
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
  > pre {
    margin: 0;
    padding: 0;
  }
  pre {
    && {
      word-break: break-all;
    }
  }
  pre > pre {
    display: inline-block;
    margin: 0 !important;
    padding: 0 !important;
  }
`;
function ValueWithActionButton({children}: {children: React.ReactNode}) {
  return (
    <Grid
      align="center"
      background="secondary"
      columns="1fr max-content"
      gap="md"
      margin="2xs 0"
      radius="md"
    >
      {({className}) => (
        <ValueWithActionButtonContent className={className}>
          {children}
        </ValueWithActionButtonContent>
      )}
    </Grid>
  );
}

const ValueWithActionButtonContent = styled('div')`
  font-size: ${p => p.theme.font.size.sm};
  padding: ${p => p.theme.space.md} 10px;
  pre {
    padding: 0 !important;
    margin: 0 !important;
  }
`;
