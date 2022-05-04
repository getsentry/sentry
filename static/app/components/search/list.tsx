import {Fragment} from 'react';
import styled from '@emotion/styled';

import AutoComplete from 'sentry/components/autoComplete';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

import {Result} from './sources/types';
import SearchResult from './searchResult';
import SearchResultWrapper from './searchResultWrapper';

type AutoCompleteOpts = Parameters<AutoComplete<Result['item']>['props']['children']>[0];

interface RenderItemProps {
  highlighted: boolean;
  item: Result['item'];
  itemProps: ReturnType<AutoCompleteOpts['getItemProps']>;
  matches: Result['matches'];
}

type Props = {
  getItemProps: AutoCompleteOpts['getItemProps'];
  hasAnyResults: boolean;
  highlightedIndex: number;
  isLoading: boolean;
  resultFooter: React.ReactNode;
  results: Result[];
  dropdownClassName?: string;
  maxResults?: number;
  renderItem?: (props: RenderItemProps) => React.ReactNode;
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
  renderItem = defaultItemRenderer,
}: Props) {
  const resultList = results.slice(0, maxResults);

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

          const itemProps = getItemProps({
            item: result.item,
            index,
          });

          return (
            <Fragment key={`${index}-${refIndex}`}>
              {renderItem({highlighted, itemProps, item, matches})}
            </Fragment>
          );
        })
      )}
      {!isLoading && resultFooter ? <ResultFooter>{resultFooter}</ResultFooter> : null}
    </DropdownBox>
  );
}

export default List;

const DropdownBox = styled('div')`
  background: ${p => p.theme.background};
  border: 1px solid ${p => p.theme.border};
  box-shadow: ${p => p.theme.dropShadowHeavy};
  position: absolute;
  top: 36px;
  right: 0;
  width: 400px;
  border-radius: 5px;
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
