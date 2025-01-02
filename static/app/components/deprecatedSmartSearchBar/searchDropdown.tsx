import {Fragment} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import HotkeysLabel from 'sentry/components/hotkeysLabel';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Overlay} from 'sentry/components/overlay';
import type {BooleanOperator, SearchConfig} from 'sentry/components/searchSyntax/parser';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';

import {SearchInvalidTag} from './searchInvalidTag';
import type {SearchGroup, SearchItem, Shortcut} from './types';
import {invalidTypes, ItemType} from './types';

const getDropdownItemKey = (item: SearchItem) =>
  `${item.value || item.desc || item.title}-${
    item.children && item.children.length > 0 ? getDropdownItemKey(item.children[0]!) : ''
  }`;

type Props = {
  items: SearchGroup[];
  loading: boolean;
  onClick: (value: string, item: SearchItem) => void;
  searchSubstring: string;
  booleanKeys?: Set<string>;
  className?: string;
  customInvalidTagMessage?: (item: SearchItem) => React.ReactNode;
  dateKeys?: Set<string>;
  disallowFreeText?: boolean;
  disallowWildcard?: boolean;
  disallowedLogicalOperators?: Set<BooleanOperator>;
  durationKeys?: Set<string>;
  invalidMessages?: SearchConfig['invalidMessages'];
  maxMenuHeight?: number;
  mergeItemsWith?: Record<string, SearchItem>;
  numericKeys?: Set<string>;
  onDocsOpen?: () => void;
  onIconClick?: (value: string) => void;
  percentageKeys?: Set<string>;
  runShortcut?: (shortcut: Shortcut) => void;
  sizeKeys?: Set<string>;
  supportedTags?: TagCollection;
  textOperatorKeys?: Set<string>;
  visibleShortcuts?: Shortcut[];
};

function SearchDropdown({
  className,
  loading,
  items,
  runShortcut,
  visibleShortcuts,
  maxMenuHeight,
  onIconClick,
  searchSubstring = '',
  onClick = () => {},
  supportedTags,
  customInvalidTagMessage,
  mergeItemsWith,
  booleanKeys,
  dateKeys,
  durationKeys,
  numericKeys,
  percentageKeys,
  onDocsOpen,
  sizeKeys,
  textOperatorKeys,
  disallowedLogicalOperators,
  disallowWildcard,
  disallowFreeText,
  invalidMessages,
}: Props) {
  return (
    <SearchDropdownOverlay className={className} data-test-id="smart-search-dropdown">
      {loading ? (
        <LoadingWrapper key="loading" data-test-id="search-autocomplete-loading">
          <LoadingIndicator mini />
        </LoadingWrapper>
      ) : (
        <SearchItemsList maxMenuHeight={maxMenuHeight}>
          {items.map(item => {
            const isEmpty = item.children && !item.children.length;
            const Wrapper = item.childrenWrapper ?? Fragment;

            // Hide header if `item.children` is defined, an array, and is empty
            return (
              <Fragment key={item.title}>
                {item.type === 'header' && <HeaderItem group={item} />}
                <Wrapper>
                  {item.children?.map(child => (
                    <DropdownItem
                      key={getDropdownItemKey(child)}
                      item={{
                        ...child,
                        ...mergeItemsWith?.[child.title!],
                      }}
                      searchSubstring={searchSubstring}
                      onClick={onClick}
                      onIconClick={onIconClick}
                      additionalSearchConfig={{
                        supportedTags,
                        disallowWildcard,
                        disallowedLogicalOperators,
                        disallowFreeText,
                        invalidMessages,
                        booleanKeys,
                        dateKeys,
                        durationKeys,
                        numericKeys,
                        percentageKeys,
                        sizeKeys,
                        textOperatorKeys,
                      }}
                      customInvalidTagMessage={customInvalidTagMessage}
                    />
                  ))}
                </Wrapper>
                {isEmpty && <Info>{t('No items found')}</Info>}
              </Fragment>
            );
          })}
        </SearchItemsList>
      )}

      <DropdownFooter>
        <ButtonBar gap={1}>
          {runShortcut &&
            visibleShortcuts?.map(shortcut => (
              <Button
                borderless
                size="xs"
                key={shortcut.text}
                onClick={() => runShortcut(shortcut)}
              >
                <HotkeyGlyphWrapper>
                  <HotkeysLabel
                    value={shortcut.hotkeys?.display ?? shortcut.hotkeys?.actual ?? []}
                  />
                </HotkeyGlyphWrapper>
                <IconWrapper>{shortcut.icon}</IconWrapper>
                {shortcut.text}
              </Button>
            ))}
        </ButtonBar>
        <LinkButton
          size="xs"
          href="https://docs.sentry.io/product/sentry-basics/search/"
          external
          onClick={() => onDocsOpen?.()}
        >
          {t('Read the docs')}
        </LinkButton>
      </DropdownFooter>
    </SearchDropdownOverlay>
  );
}

export default SearchDropdown;

type HeaderItemProps = {
  group: SearchGroup;
};

function HeaderItem({group}: HeaderItemProps) {
  return (
    <SearchDropdownGroup key={group.title}>
      <SearchDropdownGroupTitle>
        {group.icon}
        {group.title && group.title}
        {group.desc && <span>{group.desc}</span>}
      </SearchDropdownGroupTitle>
    </SearchDropdownGroup>
  );
}

type HighlightedRestOfWordsProps = {
  combinedRestWords: string;
  firstWord: string;
  searchSubstring: string;
  hasSplit?: boolean;
  isFirstWordHidden?: boolean;
};

function HighlightedRestOfWords({
  combinedRestWords,
  searchSubstring,
  firstWord,
  isFirstWordHidden,
  hasSplit,
}: HighlightedRestOfWordsProps) {
  const remainingSubstr = !searchSubstring.includes(firstWord)
    ? searchSubstring
    : searchSubstring.slice(firstWord.length + 1);
  const descIdx = combinedRestWords.indexOf(remainingSubstr);

  if (descIdx > -1) {
    return (
      <RestOfWordsContainer isFirstWordHidden={isFirstWordHidden} hasSplit={hasSplit}>
        .{combinedRestWords.slice(0, descIdx)}
        <strong>
          {combinedRestWords.slice(descIdx, descIdx + remainingSubstr.length)}
        </strong>
        {combinedRestWords.slice(descIdx + remainingSubstr.length)}
      </RestOfWordsContainer>
    );
  }
  return (
    <RestOfWordsContainer isFirstWordHidden={isFirstWordHidden} hasSplit={hasSplit}>
      .{combinedRestWords}
    </RestOfWordsContainer>
  );
}

type ItemTitleProps = {
  item: SearchItem;
  searchSubstring: string;

  isChild?: boolean;
};

function ItemTitle({item, searchSubstring, isChild}: ItemTitleProps) {
  if (!item.title) {
    return null;
  }

  const fullWord = item.title;

  const words = item.kind !== FieldKind.FUNCTION ? fullWord.split('.') : [fullWord];
  const [firstWord, ...restWords] = words;
  const isFirstWordHidden = isChild;

  const combinedRestWords = restWords.length > 0 ? restWords.join('.') : null;

  const hasSingleField = item.type === ItemType.LINK;

  if (searchSubstring) {
    const idx =
      restWords.length === 0
        ? fullWord.toLowerCase().indexOf(searchSubstring.split('.')[0]!)
        : fullWord.toLowerCase().indexOf(searchSubstring);

    // Below is the logic to make the current query bold inside the result.
    if (idx !== -1) {
      return (
        <SearchItemTitleWrapper hasSingleField={hasSingleField}>
          {!isFirstWordHidden && (
            <FirstWordWrapper>
              {firstWord!.slice(0, idx)}
              <strong>{firstWord!.slice(idx, idx + searchSubstring.length)}</strong>
              {firstWord!.slice(idx + searchSubstring.length)}
            </FirstWordWrapper>
          )}
          {combinedRestWords && (
            <HighlightedRestOfWords
              firstWord={firstWord!}
              isFirstWordHidden={isFirstWordHidden}
              searchSubstring={searchSubstring}
              combinedRestWords={combinedRestWords}
              hasSplit={words.length > 1}
            />
          )}
          {item.titleBadge}
        </SearchItemTitleWrapper>
      );
    }
  }

  return (
    <SearchItemTitleWrapper>
      {!isFirstWordHidden && <FirstWordWrapper>{firstWord}</FirstWordWrapper>}
      {combinedRestWords && (
        <RestOfWordsContainer
          isFirstWordHidden={isFirstWordHidden}
          hasSplit={words.length > 1}
        >
          .{combinedRestWords}
        </RestOfWordsContainer>
      )}
      {item.titleBadge}
    </SearchItemTitleWrapper>
  );
}

type KindTagProps = {
  kind: FieldKind;
  deprecated?: boolean;
};

function KindTag({kind, deprecated}: KindTagProps) {
  if (deprecated) {
    return <Tag type="error">deprecated</Tag>;
  }

  switch (kind) {
    case FieldKind.FUNCTION:
    case FieldKind.NUMERIC_METRICS:
      return <Tag type="success">f(x)</Tag>;
    case FieldKind.MEASUREMENT:
    case FieldKind.BREAKDOWN:
      return <Tag type="highlight">field</Tag>;
    case FieldKind.TAG:
      return <Tag type="warning">{kind}</Tag>;
    default:
      return <Tag>{kind}</Tag>;
  }
}

type DropdownItemProps = {
  item: SearchItem;
  onClick: (value: string, item: SearchItem) => void;
  searchSubstring: string;
  additionalSearchConfig?: Partial<SearchConfig>;
  customInvalidTagMessage?: (item: SearchItem) => React.ReactNode;
  isChild?: boolean;
  onIconClick?: any;
};

function DropdownItem({
  item,
  isChild,
  searchSubstring,
  onClick,
  onIconClick,
  additionalSearchConfig,
  customInvalidTagMessage,
}: DropdownItemProps) {
  const isDisabled = item.value === null;
  let children: React.ReactNode;
  if (item.type === ItemType.RECENT_SEARCH) {
    children = <QueryItem item={item} additionalSearchConfig={additionalSearchConfig} />;
  } else if (item.type && invalidTypes.includes(item.type)) {
    const customInvalidMessage = customInvalidTagMessage?.(item);
    children = customInvalidMessage ?? (
      <SearchInvalidTag
        highlightMessage={
          item.type === ItemType.INVALID_QUERY_WITH_WILDCARD
            ? t('For more information, please see the documentation')
            : undefined
        }
        message={
          item.type === ItemType.INVALID_QUERY_WITH_WILDCARD
            ? t("Wildcards aren't supported here.")
            : tct("The field [field] isn't supported here.", {
                field: <code>{item.desc}</code>,
              })
        }
      />
    );
  } else if (item.type === ItemType.LINK) {
    children = (
      <Fragment>
        <ItemTitle item={item} isChild={isChild} searchSubstring={searchSubstring} />
        {onIconClick && (
          <IconOpenWithMargin
            onClick={e => {
              // stop propagation so the item-level onClick doesn't get called
              e.stopPropagation();
              onIconClick(item.value);
            }}
          />
        )}
      </Fragment>
    );
  } else if (item.type === ItemType.RECOMMENDED) {
    children = (
      <RecommendedItem>
        <RecommendedItemTitle>{item.title}</RecommendedItemTitle>
      </RecommendedItem>
    );
  } else {
    children = (
      <Fragment>
        <ItemTitle item={item} isChild={isChild} searchSubstring={searchSubstring} />
        {item.desc && <Value hasDocs={!!item.documentation}>{item.desc}</Value>}
        <DropdownDocumentation
          documentation={item.documentation}
          searchSubstring={searchSubstring}
        />
        <TagWrapper>
          {item.kind && !isChild && (
            <KindTag kind={item.kind} deprecated={item.deprecated} />
          )}
        </TagWrapper>
      </Fragment>
    );
  }

  return (
    <Fragment>
      <SearchListItem
        role="option"
        className={`${isChild ? 'group-child' : ''} ${item.active ? 'active' : ''}`}
        data-test-id="search-autocomplete-item"
        onClick={
          !isDisabled
            ? item.type && invalidTypes.includes(item.type) && !!customInvalidTagMessage
              ? undefined
              : item.callback ?? onClick.bind(null, item.value, item)
            : undefined
        }
        ref={element => item.active && element?.scrollIntoView?.({block: 'nearest'})}
        isChild={isChild}
        isDisabled={isDisabled}
      >
        {children}
      </SearchListItem>
      {!isChild &&
        item.children?.map(child => (
          <DropdownItem
            key={getDropdownItemKey(child)}
            item={child}
            onClick={onClick}
            searchSubstring={searchSubstring}
            isChild
            additionalSearchConfig={additionalSearchConfig}
          />
        ))}
    </Fragment>
  );
}

type DropdownDocumentationProps = {
  searchSubstring: string;
  documentation?: React.ReactNode;
};

function DropdownDocumentation({
  documentation,
  searchSubstring,
}: DropdownDocumentationProps) {
  if (documentation && typeof documentation === 'string') {
    const startIndex =
      documentation.toLocaleLowerCase().indexOf(searchSubstring.toLocaleLowerCase()) ??
      -1;
    if (startIndex !== -1) {
      const endIndex = startIndex + searchSubstring.length;

      return (
        <Documentation>
          {documentation.slice(0, startIndex)}
          <strong>{documentation.slice(startIndex, endIndex)}</strong>
          {documentation.slice(endIndex)}
        </Documentation>
      );
    }
  }

  return <Documentation>{documentation}</Documentation>;
}

type QueryItemProps = {
  item: SearchItem;
  additionalSearchConfig?: Partial<SearchConfig>;
};

function QueryItem({item, additionalSearchConfig}: QueryItemProps) {
  if (!item.value) {
    return null;
  }

  const parsedQuery = parseSearch(item.value, additionalSearchConfig);

  if (!parsedQuery) {
    return null;
  }

  return (
    <QueryItemWrapper>
      <HighlightQuery parsedQuery={parsedQuery} />
    </QueryItemWrapper>
  );
}

const SearchDropdownOverlay = styled(Overlay)`
  position: absolute;
  top: 100%;
  left: -1px;
  right: -1px;
  overflow: hidden;
  margin-top: ${space(1)};
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  padding: ${space(1)};
`;

const Info = styled('div')`
  display: flex;
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray300};

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.innerBorder};
  }
`;

const SearchDropdownGroup = styled('li')``;

const SearchDropdownGroupTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};

  margin: 0;
  padding: ${space(1)} ${space(2)};

  & > svg {
    margin-right: ${space(1)};
  }
`;

const SearchItemsList = styled('ul')<{maxMenuHeight?: number}>`
  padding-left: 0;
  list-style: none;
  margin-bottom: 0;
  ${p => {
    if (p.maxMenuHeight !== undefined) {
      return `
        max-height: ${p.maxMenuHeight}px;
        overflow-y: scroll;
      `;
    }

    return `
      height: auto;
    `;
  }}
`;

const SearchListItem = styled('li')<{isChild?: boolean; isDisabled?: boolean}>`
  scroll-margin: 40px 0;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: 4px ${space(2)};

  min-height: ${p => (p.isChild ? '30px' : '36px')};
  ${p => !p.isChild && `border-top: 1px solid ${p.theme.innerBorder};`}

  ${p => {
    if (!p.isDisabled) {
      return `
        cursor: pointer;

        &:hover,
        &.active {
          background: ${p.theme.hover};
        }
      `;
    }

    return '';
  }}


  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const SearchItemTitleWrapper = styled('div')<{hasSingleField?: boolean}>`
  display: flex;
  flex-grow: 1;
  flex-shrink: ${p => (p.hasSingleField ? '1' : '0')};
  max-width: ${p => (p.hasSingleField ? '100%' : 'min(280px, 50%)')};

  color: ${p => p.theme.textColor};
  font-weight: ${p => p.theme.fontWeightNormal};
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightHeading};

  ${p => p.theme.overflowEllipsis};
`;

const RestOfWordsContainer = styled('span')<{
  hasSplit?: boolean;
  isFirstWordHidden?: boolean;
}>`
  color: ${p => (p.hasSplit ? p.theme.blue400 : p.theme.textColor)};
  margin-left: ${p => (p.isFirstWordHidden ? space(1) : '0px')};
`;

const FirstWordWrapper = styled('span')`
  font-weight: medium;
`;

const TagWrapper = styled('span')`
  flex-shrink: 0;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
`;

const Documentation = styled('span')`
  display: flex;
  flex: 2;
  padding: 0 ${space(1)};
  min-width: 0;

  ${p => p.theme.overflowEllipsis}
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.subText};
  white-space: pre;
`;

const DropdownFooter = styled(`div`)`
  width: 100%;
  min-height: 45px;
  background-color: ${p => p.theme.backgroundSecondary};
  border-top: 1px solid ${p => p.theme.innerBorder};
  flex-direction: row;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: ${space(1)};
  flex-wrap: wrap;
  gap: ${space(1)};
`;

const HotkeyGlyphWrapper = styled('span')`
  color: ${p => p.theme.gray300};
  margin-right: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const IconWrapper = styled('span')`
  display: none;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: flex;
    margin-right: ${space(0.5)};
    align-items: center;
    justify-content: center;
  }
`;

const QueryItemWrapper = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  width: 100%;
  gap: ${space(1)};
  display: flex;
  white-space: nowrap;
  word-break: normal;
  font-family: ${p => p.theme.text.familyMono};
`;

const Value = styled('span')<{hasDocs?: boolean}>`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};

  max-width: ${p => (p.hasDocs ? '280px' : 'none')};

  ${p => p.theme.overflowEllipsis};
`;

const IconOpenWithMargin = styled(IconOpen)`
  margin-left: ${space(1)};
`;

const RecommendedItem = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const RecommendedItemTitle = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
