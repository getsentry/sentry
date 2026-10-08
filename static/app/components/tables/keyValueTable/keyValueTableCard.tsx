import {Children, useRef, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Grid, Container as LayoutContainer} from '@sentry/scraps/layout';

import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';
import {useContainerColumnCount} from 'sentry/utils/useContainerColumnCount';

import {keyValueGridStyles} from './keyValueColumns';
import {type KeyValueTableVariant} from './keyValueRow';
import {
  KeyValueTableDataRow,
  type KeyValueTableDataRowProps,
} from './keyValueTableDataRow';

interface KeyValueTableCardProps {
  /**
   * Free-form content rendered below the rows, spanning the full card width.
   */
  children?: React.ReactNode;
  /**
   * KeyValueTableDataRowProps items to be rendered in this card.
   */
  contentItems?: KeyValueTableDataRowProps[];
  /**
   * Row props applied to every row, overridden by anything a content item sets.
   */
  itemProps?: Partial<KeyValueTableDataRowProps>;
  /**
   *  Flag to enable alphabetical sorting by item subject. Uses given item ordering if false.
   */
  sortAlphabetically?: boolean;
  /**
   * Title of the key value data grouping
   */
  title?: React.ReactNode;
  /**
   * Content item length which, when exceeded, displays a 'Show more' option
   */
  truncateLength?: number;
  /**
   * Subject column typography and row padding. Defaults to `code`.
   */
  variant?: KeyValueTableVariant;
}

export function KeyValueTableCard({
  children,
  contentItems = [],
  itemProps,
  title,
  truncateLength = Infinity,
  sortAlphabetically = false,
  variant = 'code',
}: KeyValueTableCardProps) {
  const [isTruncated, setIsTruncated] = useState(contentItems.length > truncateLength);

  if (contentItems.length === 0 && !children) {
    return null;
  }

  const truncatedItems = isTruncated
    ? contentItems.slice(0, truncateLength)
    : [...contentItems];

  const orderedItems = sortAlphabetically
    ? truncatedItems.sort((a, b) => a.item.subject.localeCompare(b.item.subject))
    : truncatedItems;

  return (
    <CardPanel>
      {title && <CardTitle>{title}</CardTitle>}
      {orderedItems.map((contentItem, index) => (
        <KeyValueTableDataRow
          key={String(index)}
          variant={variant}
          {...itemProps}
          {...contentItem}
        />
      ))}
      {contentItems.length > truncateLength && (
        <TruncateWrapper onClick={() => setIsTruncated(!isTruncated)}>
          {isTruncated ? t('Show more...') : t('Show less')}
        </TruncateWrapper>
      )}
      {children && <CardBody>{children}</CardBody>}
    </CardPanel>
  );
}

export function KeyValueTableCardGrid({children}: {children: React.ReactNode}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useContainerColumnCount(containerRef);

  const cards = Children.toArray(children).filter(
    (child: ReactNode) => child !== null && child !== undefined
  );

  return (
    <Grid
      align="start"
      columns={`repeat(${columnCount}, 1fr)`}
      gap="lg"
      ref={containerRef}
    >
      {splitIntoColumns(cards, columnCount).map((column, index) => (
        <LayoutContainer key={index}>{column}</LayoutContainer>
      ))}
    </Grid>
  );
}

const CardPanel = styled(Panel)`
  ${keyValueGridStyles};
  padding: ${p => p.theme.space.sm};
`;

const CardTitle = styled('div')`
  grid-column: span 2;
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  color: ${p => p.theme.tokens.content.primary};
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const CardBody = styled('div')`
  grid-column: 1 / -1;
  min-width: 0;

  pre {
    margin: 0;
  }
`;

const TruncateWrapper = styled('a')`
  display: flex;
  grid-column: 1 / -1;
  margin: ${p => p.theme.space.xs} 0;
  justify-content: center;
  font-family: ${p => p.theme.font.family.sans};
`;
