import styled from '@emotion/styled';
import sortBy from 'lodash/sortBy';

import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import type {KeyValueListData, KeyValueListDataItem} from 'sentry/types/group';
import {defined} from 'sentry/utils/defined';

import {ContextDataValue, PreformattedValue, ValueLink} from './value';

interface KeyValueTableDataListProps {
  className?: string;
  data?: KeyValueListData;
  isContextData?: boolean;
  margin?: boolean;
  raw?: boolean;
  shouldSort?: boolean;
}

export function KeyValueTableDataList({
  data,
  isContextData = false,
  shouldSort = true,
  raw = false,
  margin = false,
  className,
  ...props
}: KeyValueTableDataListProps) {
  if (!defined(data) || data.length === 0) {
    return null;
  }

  const rows = shouldSort ? sortBy(data, [({key}) => key?.toLowerCase()]) : data;

  return (
    <Grid
      className={className}
      columns={{zero: 'minmax(0, 1fr)', sm: '175px minmax(0, 1fr)'}}
      gap="md"
      marginBottom={margin ? undefined : '0'}
      role="table"
      width="100%"
      {...props}
    >
      {rows.map((item, index) => (
        <Row
          key={`${item.key}-${index}`}
          item={item}
          isContextData={isContextData}
          raw={raw}
        />
      ))}
    </Grid>
  );
}

function Row({
  item,
  isContextData,
  raw,
}: {
  isContextData: boolean;
  item: KeyValueListDataItem;
  raw: boolean;
}) {
  const {
    subject,
    subjectNode,
    subjectIcon,
    subjectDataTestId,
    meta,
    value = null,
    action,
    actionButton,
    isMultiValue,
  } = item;

  const renderValue = (v: KeyValueListDataItem['value']) =>
    item.isContextData || isContextData ? (
      <ContextDataValue value={v} meta={meta} raw={raw} subjectIcon={subjectIcon} />
    ) : (
      <PreformattedValue value={v} meta={meta} subjectIcon={subjectIcon} />
    );

  const rendered =
    isMultiValue && Array.isArray(value) ? (
      value.map((entry, index) => <PreformattedValue key={index} value={entry} />)
    ) : action?.link ? (
      <ValueLink to={action.link}>{renderValue(value)}</ValueLink>
    ) : (
      renderValue(value)
    );

  return (
    <Grid align="start" column="1 / -1" columns="subgrid" gap="md lg" role="row">
      <Container role="cell">
        <Text bold density="comfortable" wordBreak="break-word">
          {subjectNode ?? subject}
        </Text>
      </Container>
      <Container data-test-id={subjectDataTestId} minWidth="0" role="cell">
        <ValueWrapper>
          {actionButton ? (
            <ValueWithActionButton>
              {rendered}
              <Flex align="start" height="100%">
                {actionButton}
              </Flex>
            </ValueWithActionButton>
          ) : (
            rendered
          )}
        </ValueWrapper>
      </Container>
    </Grid>
  );
}

const ValueWrapper = styled('div')`
  pre {
    box-sizing: border-box;
    white-space: pre-wrap;
    margin: 2px 0;
    word-break: break-word;
    padding: 8px 10px;
    font-size: 12px;
    overflow: visible;
  }

  pre .val-string:first-child {
    padding-left: 0;
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
      {gridProps => (
        <ValueWithActionButtonContent {...gridProps}>
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
