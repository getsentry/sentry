import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {inputStyles} from 'sentry/components/input';
import {
  SearchQueryBuilerContext,
  useSearchQueryBuilder,
} from 'sentry/components/searchQueryBuilder/context';
import {PlainTextQueryInput} from 'sentry/components/searchQueryBuilder/plainTextQueryInput';
import {TokenizedQueryGrid} from 'sentry/components/searchQueryBuilder/tokenizedQueryGrid';
import {QueryInterfaceType} from 'sentry/components/searchQueryBuilder/types';
import {useQueryBuilderState} from 'sentry/components/searchQueryBuilder/useQueryBuilderState';
import {
  collapseTextTokens,
  INTERFACE_TYPE_LOCALSTORAGE_KEY,
} from 'sentry/components/searchQueryBuilder/utils';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {IconClose, IconSearch, IconSync} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types';
import PanelProvider from 'sentry/utils/panelProvider';
import {useEffectAfterFirstRender} from 'sentry/utils/useEffectAfterFirstRender';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';

interface SearchQueryBuilderProps {
  getTagValues: (key: Tag, query: string) => Promise<string[]>;
  initialQuery: string;
  supportedKeys: TagCollection;
  label?: string;
  onChange?: (query: string) => void;
}

function ActionButtons() {
  const {parsedQuery, dispatch} = useSearchQueryBuilder();
  const [queryInterface, setQueryInterface] = useSyncedLocalStorageState(
    INTERFACE_TYPE_LOCALSTORAGE_KEY,
    QueryInterfaceType.TOKENIZED
  );

  const interfaceToggleText =
    queryInterface === QueryInterfaceType.TEXT
      ? t('Switch to tokenized search')
      : t('Switch to plain text');

  return (
    <ButtonsWrapper>
      <ActionButton
        title={interfaceToggleText}
        aria-label={interfaceToggleText}
        size="zero"
        icon={<IconSync />}
        borderless
        onClick={() =>
          setQueryInterface(
            queryInterface === QueryInterfaceType.TEXT
              ? QueryInterfaceType.TOKENIZED
              : QueryInterfaceType.TEXT
          )
        }
        disabled={!parsedQuery}
      />
      <ActionButton
        aria-label={t('Clear search query')}
        size="zero"
        icon={<IconClose />}
        borderless
        onClick={() => dispatch({type: 'CLEAR'})}
      />
    </ButtonsWrapper>
  );
}

export function SearchQueryBuilder({
  label,
  initialQuery,
  supportedKeys,
  getTagValues,
  onChange,
}: SearchQueryBuilderProps) {
  const {state, dispatch} = useQueryBuilderState({initialQuery});
  const [queryInterface] = useSyncedLocalStorageState(
    INTERFACE_TYPE_LOCALSTORAGE_KEY,
    QueryInterfaceType.TOKENIZED
  );

  const parsedQuery = useMemo(
    () => collapseTextTokens(parseSearch(state.query || ' ')),
    [state.query]
  );

  useEffectAfterFirstRender(() => {
    onChange?.(state.query);
  }, [onChange, state.query]);

  const contextValue = useMemo(() => {
    return {
      ...state,
      parsedQuery,
      keys: supportedKeys,
      getTagValues,
      dispatch,
    };
  }, [state, parsedQuery, supportedKeys, getTagValues, dispatch]);

  return (
    <SearchQueryBuilerContext.Provider value={contextValue}>
      <PanelProvider>
        <Wrapper>
          <PositionedSearchIcon size="sm" />
          {!parsedQuery || queryInterface === QueryInterfaceType.TEXT ? (
            <PlainTextQueryInput label={label} />
          ) : (
            <TokenizedQueryGrid label={label} />
          )}
          <ActionButtons />
        </Wrapper>
      </PanelProvider>
    </SearchQueryBuilerContext.Provider>
  );
}

const Wrapper = styled('div')`
  ${inputStyles}
  min-height: 38px;
  padding: 0;
  height: auto;
  width: 100%;
  position: relative;
  font-size: ${p => p.theme.fontSizeMedium};
  cursor: text;

  :focus-within {
    border: 1px solid ${p => p.theme.focusBorder};
    box-shadow: 0 0 0 1px ${p => p.theme.focusBorder};
  }
`;

const ButtonsWrapper = styled('div')`
  position: absolute;
  right: 9px;
  top: 9px;
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
`;

const ActionButton = styled(Button)`
  color: ${p => p.theme.subText};
`;

const PositionedSearchIcon = styled(IconSearch)`
  color: ${p => p.theme.subText};
  position: absolute;
  left: ${space(1.5)};
  top: ${space(0.75)};
  height: 22px;
`;
