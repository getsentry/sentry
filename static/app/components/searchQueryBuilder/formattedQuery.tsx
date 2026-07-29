import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderConfig,
} from 'sentry/components/searchQueryBuilder/context';
import {FormattedQueryConfigContext} from 'sentry/components/searchQueryBuilder/formattedQueryContext';
import {AggregateKeyVisual} from 'sentry/components/searchQueryBuilder/tokens/filter/aggregateKey';
import {FilterValueText} from 'sentry/components/searchQueryBuilder/tokens/filter/filter';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {isAggregateFilterToken} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {SearchQueryBuilderParenIcon} from 'sentry/components/searchQueryBuilder/tokens/paren';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  Token,
  type ParseResultToken,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyLabel} from 'sentry/components/searchSyntax/utils';
import type {TagCollection} from 'sentry/types/group';
import {getFieldDefinition as defaultGetFieldDefinition} from 'sentry/utils/fields';

export type FormattedQueryProps = {
  query: string;
  className?: string;
  fieldDefinitionGetter?: FieldDefinitionGetter;
  filterKeyAliases?: TagCollection;
  filterKeys?: TagCollection;
  getFilterTokenWarning?: (key: string) => React.ReactNode;
  wrapTokens?: boolean;
};

type TokenProps = {
  token: ParseResultToken;
};

const EMPTY_FILTER_KEYS: TagCollection = {};
const defaultFieldDefinitionGetter: FieldDefinitionGetter = key =>
  defaultGetFieldDefinition(key);

function FilterKey({token}: {token: TokenResult<Token.FILTER>}) {
  if (token.filter === FilterType.IS || token.filter === FilterType.HAS) {
    return null;
  }

  return isAggregateFilterToken(token) ? (
    <div>
      <AggregateKeyVisual token={token} />
    </div>
  ) : (
    <div>{getKeyLabel(token.key)}</div>
  );
}

function Filter({token}: {token: TokenResult<Token.FILTER>}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const {wrapTokens} = useContext(FormattedQueryConfigContext);
  const label = useMemo(
    () =>
      getOperatorInfo({
        filterToken: token,
        fieldDefinition: getFieldDefinition(token.key.text),
      }).label,
    [token, getFieldDefinition]
  );

  return (
    <FilterWrapper aria-label={token.text} $wrapTokens={wrapTokens}>
      <FilterKey token={token} /> {label}{' '}
      <FilterValue $wrapTokens={wrapTokens}>
        <FilterValueText token={token} />
      </FilterValue>
    </FilterWrapper>
  );
}

function Boolean({token}: {token: TokenResult<Token.LOGIC_BOOLEAN>}) {
  const {wrapTokens} = useContext(FormattedQueryConfigContext);
  const label = token.text.toUpperCase();
  return (
    <FilterWrapper aria-label={label} $wrapTokens={wrapTokens}>
      <Text variant="muted">{label}</Text>
    </FilterWrapper>
  );
}

function QueryToken({token}: TokenProps) {
  const {wrapTokens} = useContext(FormattedQueryConfigContext);

  switch (token.type) {
    case Token.FILTER:
      return <Filter token={token} />;
    case Token.FREE_TEXT:
      if (token.value.trim()) {
        return (
          <Text as="span" wordBreak={wrapTokens ? 'break-word' : undefined}>
            {token.value.trim()}
          </Text>
        );
      }
      return null;
    case Token.L_PAREN:
    case Token.R_PAREN:
      return (
        <Paren>
          <SearchQueryBuilderParenIcon token={token} />
        </Paren>
      );
    case Token.LOGIC_BOOLEAN:
      return <Boolean token={token} />;
    default:
      return null;
  }
}

/**
 * Renders a formatted query string similar to how it appears in the search bar,
 * but without all the interactivity.
 *
 * Accepts `filterKeys` and `fieldDefinitionGetter`, but is only necessary for
 * rendering some filter types such as dates.
 */
export function FormattedQuery({
  className,
  query,
  fieldDefinitionGetter = defaultFieldDefinitionGetter,
  filterKeys = EMPTY_FILTER_KEYS,
  filterKeyAliases = EMPTY_FILTER_KEYS,
  wrapTokens = false,
}: FormattedQueryProps) {
  const parsedQuery = useMemo(() => {
    return parseQueryBuilderValue(query, fieldDefinitionGetter, {
      filterKeys,
      filterKeyAliases,
    });
  }, [fieldDefinitionGetter, filterKeys, query, filterKeyAliases]);
  const formattedQueryConfig = useMemo(() => ({wrapTokens}), [wrapTokens]);

  if (!parsedQuery) {
    return <QueryWrapper className={className} />;
  }

  return (
    <FormattedQueryConfigContext.Provider value={formattedQueryConfig}>
      <QueryWrapper aria-label={query} className={className}>
        {parsedQuery.map((token: any, index: any) => {
          return <QueryToken key={index} token={token} />;
        })}
      </QueryWrapper>
    </FormattedQueryConfigContext.Provider>
  );
}

/**
 * Renders a formatted query string similar to how it appears in the search bar,
 * but without all the interactivity.
 *
 * Accepts `filterKeys` and `fieldDefinitionGetter`, but is only necessary for
 * rendering some filter types such as dates.
 *
 * Use this one if your component is not wrapped in a `SearchQueryBuilderProvider`.
 */
export function ProvidedFormattedQuery({
  className,
  query,
  fieldDefinitionGetter = defaultFieldDefinitionGetter,
  filterKeys = EMPTY_FILTER_KEYS,
  filterKeyAliases = EMPTY_FILTER_KEYS,
  getFilterTokenWarning,
  wrapTokens,
}: FormattedQueryProps) {
  return (
    <SearchQueryBuilderProvider
      filterKeys={filterKeys}
      fieldDefinitionGetter={fieldDefinitionGetter}
      getTagValues={() => Promise.resolve([])}
      initialQuery={query}
      searchSource="formatted_query"
      getFilterTokenWarning={getFilterTokenWarning}
    >
      <FormattedQuery
        className={className}
        query={query}
        fieldDefinitionGetter={fieldDefinitionGetter}
        filterKeys={filterKeys}
        filterKeyAliases={filterKeyAliases}
        wrapTokens={wrapTokens}
      />
    </SearchQueryBuilderProvider>
  );
}

function QueryWrapper(props: FlexProps) {
  return <Flex {...props} align="center" wrap="wrap" gap="xs md" />;
}

type FilterWrapperProps = FlexProps & {
  $wrapTokens?: boolean;
};

export function FilterWrapper({$wrapTokens = false, ...props}: FilterWrapperProps) {
  return (
    <Flex
      {...props}
      align="center"
      gap="xs"
      background="primary"
      padding="2xs xs"
      border="secondary"
      radius="md"
      minHeight="24px"
      height={$wrapTokens ? 'auto' : '24px'}
      maxWidth="100%"
      whiteSpace="nowrap"
      overflow={$wrapTokens ? 'visible' : 'hidden'}
    />
  );
}

const FilterValue = styled('div')<{$wrapTokens?: boolean}>`
  max-width: 300px;
  min-width: 0;
  color: ${p => p.theme.tokens.content.accent};
  display: block;
  width: 100%;
  white-space: ${p => (p.$wrapTokens ? 'normal' : 'nowrap')};
  overflow: ${p => (p.$wrapTokens ? 'visible' : 'hidden')};
  text-overflow: ${p => (p.$wrapTokens ? 'clip' : 'ellipsis')};
  overflow-wrap: ${p => (p.$wrapTokens ? 'anywhere' : undefined)};
`;

function Paren({children}: {children: React.ReactNode}) {
  return (
    <Text variant="muted">
      {props => (
        <Flex {...props} align="center">
          {children}
        </Flex>
      )}
    </Text>
  );
}
