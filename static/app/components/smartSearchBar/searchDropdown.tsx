import {Fragment, PureComponent} from 'react';
import styled from '@emotion/styled';
import color from 'color';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import HighlightQuery from 'sentry/components/searchSyntax/renderer';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';

import Button from '../button';
import HotkeysLabel from '../hotkeysLabel';
import Tag from '../tag';

import {ItemType, SearchGroup, SearchItem, Shortcut} from './types';

type Props = {
  items: SearchGroup[];
  loading: boolean;
  onClick: (value: string, item: SearchItem) => void;
  searchSubstring: string;
  className?: string;
  maxMenuHeight?: number;
  runShortcut?: (shortcut: Shortcut) => void;
  visibleShortcuts?: Shortcut[];
};

class SearchDropdown extends PureComponent<Props> {
  static defaultProps = {
    searchSubstring: '',
    onClick: function () {},
  };

  renderItemTitle = (item: SearchItem) => {
    const fullWord = item.title ?? '';

    const words =
      item.kind !== FieldValueKind.FUNCTION ? fullWord.split('.') : [fullWord];
    const [firstWord, ...restWords] = words;
    const hideFirstWord = item.isGrouped && item.isChild;

    const combinedRestWords = restWords.length > 0 ? restWords.join('.') : null;

    const searchSubstring = this.props.searchSubstring;

    if (searchSubstring) {
      const idx = fullWord.toLowerCase().indexOf(searchSubstring);

      if (idx !== -1) {
        let renderedRest: React.ReactNode;
        if (combinedRestWords) {
          const remainingSubstr = searchSubstring.slice(firstWord.length + 1);
          const descIdx = combinedRestWords.indexOf(remainingSubstr);
          if (descIdx > -1) {
            renderedRest = (
              <RestOfWords hasSplit={words.length > 1}>
                .{combinedRestWords.slice(0, descIdx)}
                <strong>
                  {combinedRestWords.slice(descIdx, remainingSubstr.length)}
                </strong>
                {combinedRestWords.slice(descIdx + remainingSubstr.length)}
              </RestOfWords>
            );
          } else {
            renderedRest = combinedRestWords;
          }
        }

        return (
          <Fragment>
            <FirstWordWrapper hide={hideFirstWord} aria-hidden={hideFirstWord}>
              {firstWord.slice(0, idx)}
              <strong>{firstWord.slice(idx, searchSubstring.length)}</strong>
              {firstWord.slice(idx + searchSubstring.length)}
            </FirstWordWrapper>
            {renderedRest}
          </Fragment>
        );
      }
    } else if (item.type === ItemType.INVALID_TAG) {
      return (
        <Invalid>
          {tct("The field [field] isn't supported here. ", {
            field: <strong>{item.desc}</strong>,
          })}
          {tct('[highlight:See all searchable properties in the docs.]', {
            highlight: <Highlight />,
          })}
        </Invalid>
      );
    }

    return (
      <Fragment>
        <FirstWordWrapper hide={hideFirstWord} aria-hidden={hideFirstWord}>
          {firstWord}
        </FirstWordWrapper>
        {combinedRestWords && (
          <RestOfWords hasSplit={words.length > 1}>.{combinedRestWords}</RestOfWords>
        )}
      </Fragment>
    );
  };

  renderHeaderItem = (item: SearchGroup) => (
    <SearchDropdownGroup key={item.title}>
      <SearchDropdownGroupTitle>
        {item.icon}
        {item.title && item.title}
        {item.desc && <span>{item.desc}</span>}
      </SearchDropdownGroupTitle>
    </SearchDropdownGroup>
  );

  renderQueryItem = (item: SearchItem) => {
    if (!item.value) {
      return null;
    }

    const parsedQuery = parseSearch(item.value);

    if (!parsedQuery) {
      return null;
    }

    return (
      <QueryItemWrapper>
        <HighlightQuery parsedQuery={parsedQuery} />
      </QueryItemWrapper>
    );
  };

  renderItem = (item: SearchItem) => {
    return (
      <SearchListItem
        key={item.value || item.desc || item.title}
        className={`${item.isChild ? 'group-child' : ''} ${item.active ? 'active' : ''}`}
        data-test-id="search-autocomplete-item"
        onClick={item.callback ?? this.props.onClick.bind(this, item.value, item)}
        ref={element => item.active && element?.scrollIntoView?.({block: 'nearest'})}
        isGrouped={item.isGrouped}
        isChild={item.isChild}
      >
        {item.type === ItemType.RECENT_SEARCH ? (
          this.renderQueryItem(item)
        ) : (
          <Fragment>
            <SearchItemTitleWrapper>
              {this.renderItemTitle(item)}
              {item.desc && <span>{item.desc}</span>}
            </SearchItemTitleWrapper>
            <Documentation>{item.documentation}</Documentation>
            <TagWrapper>
              {item.kind && !item.isChild && this.renderKind(item.kind)}
            </TagWrapper>
          </Fragment>
        )}
      </SearchListItem>
    );
  };

  renderKind(kind: FieldValueKind) {
    let text, tagType;
    switch (kind) {
      case FieldValueKind.FUNCTION:
        text = 'f(x)';
        tagType = 'success';
        break;
      case FieldValueKind.MEASUREMENT:
        text = 'field';
        tagType = 'highlight';
        break;
      case FieldValueKind.BREAKDOWN:
        text = 'field';
        tagType = 'highlight';
        break;
      case FieldValueKind.TAG:
        text = kind;
        tagType = 'warning';
        break;
      case FieldValueKind.NUMERIC_METRICS:
        text = 'f(x)';
        tagType = 'success';
        break;
      case FieldValueKind.FIELD:
      default:
        text = kind;
    }
    return <Tag type={tagType}>{text}</Tag>;
  }

  render() {
    const {className, loading, items, runShortcut, visibleShortcuts, maxMenuHeight} =
      this.props;
    return (
      <StyledSearchDropdown className={className}>
        {loading ? (
          <LoadingWrapper key="loading" data-test-id="search-autocomplete-loading">
            <LoadingIndicator mini />
          </LoadingWrapper>
        ) : (
          <SearchItemsList maxMenuHeight={maxMenuHeight}>
            {items.map(item => {
              const isEmpty = item.children && !item.children.length;

              // Hide header if `item.children` is defined, an array, and is empty
              return (
                <Fragment key={item.title}>
                  {item.type === 'header' && this.renderHeaderItem(item)}
                  {item.children && item.children.map(this.renderItem)}
                  {isEmpty && <Info>{t('No items found')}</Info>}
                </Fragment>
              );
            })}
          </SearchItemsList>
        )}
        <DropdownFooter>
          <ShortcutsRow>
            {runShortcut &&
              visibleShortcuts?.map(shortcut => {
                return (
                  <ShortcutButtonContainer
                    key={shortcut.text}
                    onClick={() => runShortcut(shortcut)}
                  >
                    <HotkeyGlyphWrapper>
                      <HotkeysLabel value={shortcut.hotkeys?.display ?? []} />
                    </HotkeyGlyphWrapper>
                    <IconWrapper>{shortcut.icon}</IconWrapper>
                    <HotkeyTitle>{shortcut.text}</HotkeyTitle>
                  </ShortcutButtonContainer>
                );
              })}
          </ShortcutsRow>
          <Button
            size="xsmall"
            href="https://docs.sentry.io/product/sentry-basics/search/"
          >
            Read the docs
          </Button>
        </DropdownFooter>
      </StyledSearchDropdown>
    );
  }
}

export default SearchDropdown;

const StyledSearchDropdown = styled('div')`
  /* Container has a border that we need to account for */
  position: absolute;
  top: 100%;
  left: -1px;
  right: -1px;
  z-index: ${p => p.theme.zIndex.dropdown};
  overflow: hidden;
  margin-top: ${space(1)};
  background: ${p => p.theme.background};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
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

const ListItem = styled('li')`
  &:not(:first-child):not(.group-child) {
    border-top: 1px solid ${p => p.theme.innerBorder};
  }
`;

const SearchDropdownGroup = styled(ListItem)``;

const SearchDropdownGroupTitle = styled('header')`
  display: flex;
  align-items: center;

  background-color: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.gray300};
  font-weight: normal;
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

const SearchListItem = styled(ListItem)<{isChild?: boolean; isGrouped?: boolean}>`
  scroll-margin: 40px 0;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: 4px ${space(2)};

  min-height: ${p => (p.isGrouped ? '30px' : '36px')};
  cursor: pointer;

  &:hover,
  &.active {
    background: ${p => p.theme.hover};
  }
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  width: 100%;
`;

const SearchItemTitleWrapper = styled('div')`
  color: ${p => p.theme.textColor};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeMedium};
  margin: 0;
  line-height: ${p => p.theme.text.lineHeightHeading};

  display: flex;
  flex-grow: 1;
  flex-shrink: none;

  max-width: 280px;

  ${p => p.theme.overflowEllipsis};
`;

const RestOfWords = styled('span')<{hasSplit?: boolean}>`
  color: ${p => (p.hasSplit ? p.theme.blue400 : p.theme.textColor)};
`;

const FirstWordWrapper = styled('span')<{hide?: boolean}>`
  opacity: ${p => (p.hide ? 0 : 1)};
  font-weight: medium;
`;

const TagWrapper = styled('span')`
  width: 5%;
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: flex-end;
`;

const Documentation = styled('span')`
  font-size: ${p => p.theme.fontSizeMedium};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.gray300};
  display: flex;
  flex: 2;
  padding: 0 ${space(1)};

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
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

const ShortcutsRow = styled('div')`
  flex-direction: row;
  display: flex;
  align-items: center;
`;

const ShortcutButtonContainer = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  height: auto;
  padding: 0 ${space(1.5)};

  cursor: pointer;

  :hover {
    border-radius: ${p => p.theme.borderRadius};
    background-color: ${p => color(p.theme.hover).darken(0.02).string()};
  }
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

const HotkeyTitle = styled(`span`)`
  font-size: ${p => p.theme.fontSizeSmall};
`;

const Invalid = styled(`span`)`
  font-size: ${p => p.theme.fontSizeSmall};
  font-family: ${p => p.theme.text.family};
  color: ${p => p.theme.gray400};
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;

  span {
    white-space: pre;
  }
`;

const Highlight = styled(`strong`)`
  color: ${p => p.theme.linkColor};
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
