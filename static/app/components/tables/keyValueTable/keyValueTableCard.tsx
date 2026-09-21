import {Children, useRef, useState, type ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container as LayoutContainer} from '@sentry/scraps/layout';

import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {Panel} from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {splitIntoColumns} from 'sentry/utils/array/splitIntoColumns';

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
   * If true, expands the left side of the cards to take up more space.
   */
  expandLeft?: boolean;
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
}

export function KeyValueTableCard({
  children,
  contentItems = [],
  title,
  truncateLength = Infinity,
  sortAlphabetically = false,
  expandLeft = false,
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
      {orderedItems.map((itemProps, index) => (
        <KeyValueTableDataRow
          expandLeft={expandLeft}
          key={String(index)}
          {...itemProps}
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
  const columnCount = useIssueDetailsColumnCount(containerRef);

  const cards = Children.toArray(children).filter(
    (child: ReactNode) => child !== null && child !== undefined
  );

  return (
    <CardGridWrapper columnCount={columnCount} ref={containerRef}>
      {splitIntoColumns(cards, columnCount).map((column, index) => (
        <LayoutContainer column="span 1" key={index}>
          {column}
        </LayoutContainer>
      ))}
    </CardGridWrapper>
  );
}

const CardPanel = styled(Panel)`
  padding: ${p => p.theme.space.sm};
  display: grid;
  column-gap: ${p => p.theme.space.lg};
  grid-template-columns: fit-content(50%) 1fr;
  font-size: ${p => p.theme.font.size.sm};
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

const CardGridWrapper = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  gap: 10px;
`;
