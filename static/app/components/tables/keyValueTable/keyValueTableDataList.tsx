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
  keyPadding?: React.ComponentProps<typeof Container>['padding'];
  margin?: boolean;
  raw?: boolean;
  rowDivider?: boolean;
  rowPadding?: React.ComponentProps<typeof Grid>['padding'];
  shouldSort?: boolean;
}

export function KeyValueTableDataList({
  data,
  isContextData = false,
  keyPadding,
  shouldSort = true,
  raw = false,
  rowDivider = false,
  rowPadding,
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
      columns="175px minmax(0, 1fr)"
      gap="md"
      marginBottom={margin ? '2xl' : undefined}
      role="table"
      width="100%"
      {...props}
    >
      {rows.map((item, index) => (
        <Row
          key={`${item.key}-${index}`}
          item={item}
          isContextData={isContextData}
          keyPadding={keyPadding}
          raw={raw}
          rowDivider={rowDivider}
          rowPadding={rowPadding}
        />
      ))}
    </Grid>
  );
}

function Row({
  item,
  isContextData,
  keyPadding,
  raw,
  rowDivider,
  rowPadding,
}: {
  isContextData: boolean;
  item: KeyValueListDataItem;
  keyPadding: React.ComponentProps<typeof Container>['padding'];
  raw: boolean;
  rowDivider: boolean;
  rowPadding: React.ComponentProps<typeof Grid>['padding'];
}) {
  const {
    subject,
    subjectNode,
    subjectIcon,
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
    <Grid
      align="start"
      borderTop={rowDivider ? 'primary' : undefined}
      column="1 / -1"
      columns="subgrid"
      gap="md lg"
      padding={rowPadding}
      role="row"
    >
      <Container padding={keyPadding} role="cell">
        <Text as="div" bold density="comfortable" wordBreak="break-word">
          {subjectNode ?? subject}
        </Text>
      </Container>
      <Container minWidth="0" role="cell">
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
      columns={{zero: '1fr', xl: '1fr max-content'}}
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
