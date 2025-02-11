import {Fragment, memo, useEffect, useMemo} from 'react';
import styled from '@emotion/styled';

import type AutoComplete from 'sentry/components/autoComplete';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {Result} from './sources/types';
import SearchResult from './searchResult';
import SearchResultWrapper from './searchResultWrapper';

type AutoCompleteOpts = Parameters<AutoComplete<Result['item']>['props']['children']>[0];

interface RenderItemProps {
  highlighted: boolean;
  index: number;
  item: Result['item'];
  itemProps: ReturnType<AutoCompleteOpts['getItemProps']>;
  matches: Result['matches'];
}

type RenderItem = (props: RenderItemProps) => React.ReactNode;

type Props = {
  getItemProps: AutoCompleteOpts['getItemProps'];
  hasAnyResults: boolean;
  highlightedIndex: number;
  isLoading: boolean;
  registerItemCount: AutoCompleteOpts['registerItemCount'];
  registerVisibleItem: AutoCompleteOpts['registerVisibleItem'];
  resultFooter: React.ReactNode;
  results: Result[];
  dropdownClassName?: string;
  maxResults?: number;
  renderItem?: RenderItem;
};

function defaultItemRenderer({item, highlighted, itemProps, matches}: RenderItemProps) {
  return (
    <SearchResultWrapper highlighted={highlighted} {...itemProps}>
      <SearchResult highlighted={highlighted} item={item} matches={matches} />
    </SearchResultWrapper>
  );
}

function List({
  dropdownClassName,
  isLoading,
  hasAnyResults,
  results,
  maxResults,
  getItemProps,
  highlightedIndex,
  resultFooter,
  registerItemCount,
  registerVisibleItem,
  renderItem = defaultItemRenderer,
}: Props) {
  const resultList = results.slice(0, maxResults);

  useEffect(
    () => registerItemCount(resultList.length),
    [registerItemCount, resultList.length]
  );

  return (
    <DropdownBox className={dropdownClassName}>
      {isLoading ? (
        <LoadingWrapper>
          <LoadingIndicator mini hideMessage relative />
        </LoadingWrapper>
      ) : !hasAnyResults ? (
        <EmptyItem>{t('No results found')}</EmptyItem>
      ) : (
        resultList.map((result, index) => {
          const {item, matches, refIndex} = result;
          const highlighted = index === highlightedIndex;

          const resultProps = {
            renderItem,
            registerVisibleItem,
            getItemProps,
            highlighted,
            index,
            item,
            matches,
          };

          return <ResultRow key={`${index}-${refIndex}`} {...resultProps} />;
        })
      )}
      {!isLoading && resultFooter ? <ResultFooter>{resultFooter}</ResultFooter> : null}
    </DropdownBox>
  );
}

type SearchItemProps = {
  getItemProps: Props['getItemProps'];
  highlighted: boolean;
  index: number;
  item: Result['item'];
  matches: Result['matches'];
  registerVisibleItem: Props['registerVisibleItem'];
  renderItem: RenderItem;
};

// XXX(epurkhiser): We memoize the ResultRow component since there will be many
// of them, we do not want them re-rendering every time we change the
// highlightedIndex in the parent List.

/**
 * Search item is used to call `registerVisibleItem` any time the item changes
 */
const ResultRow = memo(
  ({
    renderItem,
    registerVisibleItem,
    getItemProps,
    ...renderItemProps
  }: SearchItemProps) => {
    const {item, index} = renderItemProps;
    useEffect(() => registerVisibleItem(index, item), [registerVisibleItem, index, item]);

    const itemProps = useMemo(
      () => getItemProps({item, index}),
      [getItemProps, item, index]
    );

    return <Fragment>{renderItem({itemProps, ...renderItemProps})}</Fragment>;
  }
);

export default List;

const DropdownBox = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  overflow: auto;
  max-height: 60vh;
`;

const ResultFooter = styled('div')`
  position: sticky;
  bottom: 0;
  left: 0;
  right: 0;
`;

const EmptyItem = styled(SearchResultWrapper)`
  text-align: center;
  padding: 16px;
  opacity: 0.5;
`;

const LoadingWrapper = styled('div')`
  display: flex;
  justify-content: center;
  align-items: center;
  padding: ${space(1)};
`;
