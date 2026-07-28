import {Children, useRef, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {useColumnCount} from 'sentry/utils/useColumnCount';

import {DefinitionList, KeyValueRow, KeyValueRowContext} from './row';
import type {
  KeyValueEntry,
  KeyValueKeyColumn,
  KeyValueLayout,
  KeyValueValueDisplay,
} from './row';

interface KeyValueBaseProps {
  /**
   * `list` suits short scalar values: one line each, ellipsised, right aligned. `detail`
   * suits long content: monospace, wrapping across as many lines as it needs.
   */
  layout: KeyValueLayout;
  /**
   * Wraps the list in a panel: border, background and padding.
   */
  card?: boolean;
  className?: string;
  'data-test-id'?: string;
  /**
   * How much of the available width the key column takes: an equal split, `wide` for
   * roughly twice the value column, or `fit` to shrink to the widest key.
   */
  keyColumn?: KeyValueKeyColumn;
  /**
   * Orders entries by `key` (case-insensitive) or `subject`. Leaving this unset preserves
   * the order of `items`.
   */
  sort?: 'key' | 'subject';
  title?: React.ReactNode;
  /**
   * Number of entries to show before a "Show more" toggle appears.
   */
  truncateLength?: number;
  /**
   * Defaults to `formatted` when `card` is set and `raw` otherwise.
   */
  valueDisplay?: KeyValueValueDisplay;
}

/**
 * Entries either come from `items` or are composed as `KeyValue.Row` children. Sorting and
 * truncation only apply to `items`.
 */
type KeyValueContent =
  | {children: React.ReactNode; items?: never}
  | {items: KeyValueEntry[]; children?: never};

export type KeyValueProps = KeyValueBaseProps & KeyValueContent;

function KeyValueRoot({
  card = false,
  children,
  className,
  'data-test-id': testId,
  items = [],
  keyColumn = 'equal',
  layout,
  sort,
  title,
  truncateLength = Infinity,
  valueDisplay,
}: KeyValueProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (children === undefined && items.length === 0) {
    return null;
  }

  const isTruncated = !isExpanded && items.length > truncateLength;
  const sorted = sortEntries(items, sort);
  const display = valueDisplay ?? (card ? 'formatted' : 'raw');

  const list = (
    <DefinitionList
      className={card || title ? undefined : className}
      data-test-id={card || title ? undefined : testId}
      keyColumn={keyColumn}
      layout={layout}
    >
      <KeyValueRowContext value={{layout, valueDisplay: display}}>
        {children === undefined
          ? (isTruncated ? sorted.slice(0, truncateLength) : sorted).map(
              (entry, index) => (
                <KeyValueRow entry={entry} key={`${entry.key}-${index}`} />
              )
            )
          : children}
      </KeyValueRowContext>
    </DefinitionList>
  );

  const footer =
    items.length > truncateLength ? (
      <Button onClick={() => setIsExpanded(!isExpanded)} size="xs" variant="link">
        {isTruncated ? t('Show more...') : t('Show less')}
      </Button>
    ) : null;

  if (!card && !title && !footer) {
    return list;
  }

  const content = (
    <Stack
      className={card ? undefined : className}
      data-test-id={card ? undefined : testId}
      gap="sm"
    >
      {title && <KeyValueTitle>{title}</KeyValueTitle>}
      {list}
      {footer && <Container>{footer}</Container>}
    </Stack>
  );

  return card ? (
    <KeyValuePanel className={className} data-test-id={testId}>
      {content}
    </KeyValuePanel>
  ) : (
    content
  );
}

/**
 * Conditionally rendered children must resolve to `null` rather than rendering a
 * `KeyValue` that returns `null`, otherwise empty cards are counted when sizing columns.
 */
function KeyValueContainer({children}: {children: ReactNode}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useColumnCount(containerRef);

  const cards = Children.toArray(children);
  const columnSize = Math.ceil(cards.length / columnCount);
  const columns: ReactNode[] = [];

  for (let i = 0; i < cards.length; i += columnSize) {
    columns.push(
      <Container column="span 1" key={i}>
        {cards.slice(i, i + columnSize)}
      </Container>
    );
  }

  return (
    <Grid
      align="start"
      columns={`repeat(${columnCount}, 1fr)`}
      gap="md"
      ref={containerRef}
    >
      {columns}
    </Grid>
  );
}

function KeyValueTitle({children}: {children: React.ReactNode}) {
  return (
    <Text as="div" bold>
      {children}
    </Text>
  );
}

function sortEntries(entries: KeyValueEntry[], sort: KeyValueProps['sort']) {
  switch (sort) {
    case 'key':
      return [...entries].sort((a, b) => {
        const [aKey, bKey] = [a.key.toLowerCase(), b.key.toLowerCase()];
        return aKey < bKey ? -1 : aKey > bKey ? 1 : 0;
      });
    case 'subject':
      return [...entries].sort((a, b) =>
        (a.subject ?? a.key).localeCompare(b.subject ?? b.key)
      );
    default:
      return entries;
  }
}

export const KeyValuePanel = styled(Panel)`
  margin: 0;
  padding: ${p => p.theme.space.sm};
`;

export const KeyValue = Object.assign(KeyValueRoot, {
  Container: KeyValueContainer,
  Row: KeyValueRow,
  Title: KeyValueTitle,
});

export {KeyValueDefinition, KeyValueTerm} from './row';

export type {KeyValueEntry, KeyValueStatus} from './row';
