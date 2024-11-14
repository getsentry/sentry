import {Children, type ReactNode, useRef, useState} from 'react';
import React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {AnnotatedTextErrors} from 'sentry/components/events/meta/annotatedText/annotatedTextErrors';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import {StructuredData} from 'sentry/components/structuredEventData';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {KeyValueListDataItem, MetaError} from 'sentry/types/group';
import {defined} from 'sentry/utils';

export interface KeyValueDataContentProps {
  /**
   * Specifies the item to display.
   * - If set, item.subjectNode will override displaying item.subject.
   * - If item.subjectNode is null, the value section will span the whole card.
   * - If item.action.link is specified, the value will appear as a link.
   * - If item.actionButton is specified, the button will be rendered inline with the value.
   */
  item: KeyValueListDataItem;
  /**
   * If enabled, renders raw value instead of formatted structured data
   */
  disableFormattedData?: boolean;
  /**
   * If enabled, avoids rendering links, even if provided via `item.action.link`.
   */
  disableLink?: boolean;
  /**
   * Errors pertaining to content item
   */
  errors?: MetaError[];
  /**
   * If true, expands the left side of the cards to take up more space.
   */
  expandLeft?: boolean;
  /**
   * Used for the feature flag section.
   * If true, then the row will be highlighted in red.
   */
  isSuspectFlag?: boolean;
  /**
   * Metadata pertaining to content item
   */
  meta?: Record<string, any>;
}

export function Content({
  item,
  meta,
  errors = [],
  disableLink = false,
  disableFormattedData = false,
  isSuspectFlag = false,
  expandLeft,
  ...props
}: KeyValueDataContentProps) {
  const {
    subject,
    subjectNode,
    value: contextValue,
    action = {},
    actionButton,
    actionButtonAlwaysVisible,
  } = item;

  const hasErrors = errors.length > 0;
  const hasSuffix = !!(hasErrors || actionButton);

  const dataComponent = disableFormattedData ? (
    React.isValidElement(contextValue) ? (
      contextValue
    ) : (
      <AnnotatedText value={contextValue as string} meta={meta} />
    )
  ) : (
    <StructuredData
      value={contextValue}
      maxDefaultDepth={0}
      meta={meta}
      withAnnotatedText
      withOnlyFormattedText
    />
  );

  return (
    <ContentWrapper
      expandLeft={expandLeft}
      hasErrors={hasErrors}
      isSuspectFlag={isSuspectFlag}
      {...props}
    >
      {subjectNode !== undefined ? subjectNode : <Subject>{subject}</Subject>}
      <ValueSection hasErrors={hasErrors} hasEmptySubject={subjectNode === null}>
        <ValueWrapper hasSuffix={hasSuffix}>
          {!disableLink && defined(action?.link) ? (
            <ValueLink to={action.link}>{dataComponent}</ValueLink>
          ) : (
            dataComponent
          )}
        </ValueWrapper>
        {hasSuffix && (
          <div>
            {hasErrors && <AnnotatedTextErrors errors={errors} />}
            {actionButton && (
              <ActionButtonWrapper actionButtonAlwaysVisible={actionButtonAlwaysVisible}>
                {actionButton}
              </ActionButtonWrapper>
            )}
          </div>
        )}
      </ValueSection>
    </ContentWrapper>
  );
}

export interface KeyValueDataCardProps {
  /**
   * ContentProps items to be rendered in this card.
   */
  contentItems: KeyValueDataContentProps[];
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

export function Card({
  contentItems,
  title,
  truncateLength = Infinity,
  sortAlphabetically = false,
  expandLeft = false,
}: KeyValueDataCardProps) {
  const [isTruncated, setIsTruncated] = useState(contentItems.length > truncateLength);

  if (contentItems.length === 0) {
    return null;
  }

  const truncatedItems = isTruncated
    ? contentItems.slice(0, truncateLength)
    : [...contentItems];

  const orderedItems = sortAlphabetically
    ? truncatedItems.sort((a, b) => a.item.subject.localeCompare(b.item.subject))
    : truncatedItems;

  const componentItems = orderedItems.map((itemProps, i) => (
    <Content expandLeft={expandLeft} key={`content-card-${title}-${i}`} {...itemProps} />
  ));

  return (
    <CardPanel>
      {title && <Title>{title}</Title>}
      {componentItems}
      {contentItems.length > truncateLength && (
        <TruncateWrapper onClick={() => setIsTruncated(!isTruncated)}>
          {isTruncated ? t('Show more...') : t('Show less')}
        </TruncateWrapper>
      )}
    </CardPanel>
  );
}

// Returns an array of children where null/undefined children are filtered out.
// For example:
// <Component1/> --> returns a <Card/>
// {null}
// <Component2/> --> returns a <Card/>
// Gives us back [<Component1/>, <Component2/>]
const filterChildren = (children: ReactNode): ReactNode[] => {
  return Children.toArray(children).filter(
    (child: ReactNode) => child !== null && child !== undefined
  );
};

// Note: When conditionally rendering children, instead of returning
// if(!condition) return null inside Component, we should render  {condition ? <Component/> : null}
// where Component returns a <Card/>. {null} is ignored when distributing cards into columns.
export function Container({children}: {children: React.ReactNode}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);

  const columns: React.ReactNode[] = [];

  // Filter out null/undefined children, so that we don't count them
  // when determining column size.
  const cards = filterChildren(children);

  // Evenly distributing the cards into columns.
  const columnSize = Math.ceil(cards.length / columnCount);
  for (let i = 0; i < cards.length; i += columnSize) {
    columns.push(<CardColumn key={i}>{cards.slice(i, i + columnSize)}</CardColumn>);
  }

  return (
    <CardWrapper columnCount={columnCount} ref={containerRef}>
      {columns}
    </CardWrapper>
  );
}

export const CardPanel = styled(Panel)`
  padding: ${space(0.75)};
  display: grid;
  column-gap: ${space(1.5)};
  grid-template-columns: fit-content(50%) 1fr;
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Title = styled('div')`
  grid-column: span 2;
  padding: ${space(0.25)} ${space(0.75)};
  color: ${p => p.theme.headingColor};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ContentWrapper = styled('div')<{
  hasErrors: boolean;
  isSuspectFlag: boolean;
  expandLeft?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p => (p.expandLeft ? '0.95fr 0.41fr' : 'subgrid')};
  grid-column: span 2;
  column-gap: ${space(1.5)};
  padding: ${space(0.25)} ${space(0.75)};
  border-radius: 4px;
  color: ${p =>
    p.hasErrors
      ? p.theme.alert.error.color
      : p.isSuspectFlag
        ? p.theme.yellow400
        : p.theme.subText};
  box-shadow: inset 0 0 0 1px
    ${p =>
      p.hasErrors ? p.theme.red100 : p.isSuspectFlag ? p.theme.yellow100 : 'transparent'};
  background-color: ${p =>
    p.hasErrors
      ? p.theme.alert.error.backgroundLight
      : p.isSuspectFlag
        ? p.theme.yellow100
        : p.theme.background};
  &:nth-child(odd) {
    background-color: ${p =>
      p.hasErrors
        ? p.theme.alert.error.backgroundLight
        : p.isSuspectFlag
          ? p.theme.yellow100
          : p.theme.backgroundSecondary};
  }
`;

export const Subject = styled('div')`
  grid-column: span 1;
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-word;
  min-width: 100px;
`;

const ValueSection = styled('div')<{hasEmptySubject: boolean; hasErrors: boolean}>`
  font-family: ${p => p.theme.text.familyMono};
  word-break: break-word;
  color: ${p => (p.hasErrors ? 'inherit' : p.theme.textColor)};
  grid-column: ${p => (p.hasEmptySubject ? '1 / -1' : 'span 1')};
  display: grid;
  grid-template-columns: 1fr auto;
  grid-column-gap: ${space(0.5)};
`;

const ValueWrapper = styled('div')<{hasSuffix: boolean}>`
  word-break: break-word;
  grid-column: ${p => (p.hasSuffix ? 'span 1' : '1 / -1')};
`;

const TruncateWrapper = styled('a')`
  display: flex;
  grid-column: 1 / -1;
  margin: ${space(0.5)} 0;
  justify-content: center;
  font-family: ${p => p.theme.text.family};
`;

const CardWrapper = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  gap: 10px;
`;

const CardColumn = styled('div')`
  grid-column: span 1;
`;

export const ValueLink = styled(Link)`
  text-decoration: ${p => p.theme.linkUnderline} underline dotted;
`;

const ActionButtonWrapper = styled('div')<{actionButtonAlwaysVisible?: boolean}>`
  ${p =>
    !p.actionButtonAlwaysVisible &&
    css`
      visibility: hidden;
      ${ContentWrapper}:hover & {
        visibility: visible;
      }
    `}
`;

export const KeyValueData = {
  Title,
  Content,
  Card,
  CardPanel,
  Container,
};

export default KeyValueData;
