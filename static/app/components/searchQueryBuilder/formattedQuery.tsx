import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SearchQueryBuilderProvider} from 'sentry/components/searchQueryBuilder/context';
import {AggregateKeyVisual} from 'sentry/components/searchQueryBuilder/tokens/filter/aggregateKey';
import {FilterValueText} from 'sentry/components/searchQueryBuilder/tokens/filter/filter';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {isAggregateFilterToken} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {SearchQueryBuilderParenIcon} from 'sentry/components/searchQueryBuilder/tokens/paren';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyLabel} from 'sentry/components/searchSyntax/utils';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {getFieldDefinition} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';

export type FormattedQueryProps = {
  query: string;
  className?: string;
  fieldDefinitionGetter?: FieldDefinitionGetter;
  filterKeyAliases?: TagCollection;
  filterKeys?: TagCollection;
};

type TokenProps = {
  token: ParseResultToken;
};

const EMPTY_FILTER_KEYS: TagCollection = {};

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
  const organization = useOrganization();
  const hasWildcardOperators = organization.features.includes(
    'search-query-builder-wildcard-operators'
  );

  return (
    <FilterWrapper aria-label={token.text}>
      <FilterKey token={token} /> {getOperatorInfo(token, hasWildcardOperators).label}{' '}
      <FilterValue>
        <FilterValueText token={token} />
      </FilterValue>
    </FilterWrapper>
  );
}

function QueryToken({token}: TokenProps) {
  switch (token.type) {
    case Token.FILTER:
      return <Filter token={token} />;
    case Token.FREE_TEXT:
      if (token.value.trim()) {
        return <span>{token.value.trim()}</span>;
      }
      return null;
    case Token.L_PAREN:
    case Token.R_PAREN:
      return (
        <Boolean>
          <SearchQueryBuilderParenIcon token={token} />
        </Boolean>
      );
    case Token.LOGIC_BOOLEAN:
      return <Boolean>{token.text}</Boolean>;
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
  fieldDefinitionGetter = getFieldDefinition,
  filterKeys = EMPTY_FILTER_KEYS,
  filterKeyAliases = EMPTY_FILTER_KEYS,
}: FormattedQueryProps) {
  const parsedQuery = useMemo(() => {
    return parseQueryBuilderValue(query, fieldDefinitionGetter, {
      filterKeys,
      filterKeyAliases,
    });
  }, [fieldDefinitionGetter, filterKeys, query, filterKeyAliases]);

  if (!parsedQuery) {
    return <QueryWrapper className={className} />;
  }

  return (
    <QueryWrapper aria-label={query} className={className}>
      {parsedQuery.map((token: any, index: any) => {
        return <QueryToken key={index} token={token} />;
      })}
    </QueryWrapper>
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
  fieldDefinitionGetter = getFieldDefinition,
  filterKeys = EMPTY_FILTER_KEYS,
  filterKeyAliases = EMPTY_FILTER_KEYS,
}: FormattedQueryProps) {
  return (
    <SearchQueryBuilderProvider
      filterKeys={filterKeys}
      fieldDefinitionGetter={fieldDefinitionGetter}
      getTagValues={() => Promise.resolve([])}
      initialQuery={query}
      searchSource="formatted_query"
    >
      <FormattedQuery
        className={className}
        query={query}
        fieldDefinitionGetter={fieldDefinitionGetter}
        filterKeys={filterKeys}
        filterKeyAliases={filterKeyAliases}
      />
    </SearchQueryBuilderProvider>
  );
}

const QueryWrapper = styled('div')`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  row-gap: ${space(0.5)};
  column-gap: ${space(1)};
`;

const FilterWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  background: ${p => p.theme.background};
  padding: ${space(0.25)} ${space(0.5)};
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  height: 24px;
  white-space: nowrap;
  overflow: hidden;
`;

const FilterValue = styled('div')`
  width: 100%;
  max-width: 300px;
  color: ${p => p.theme.purple400};
  ${p => p.theme.overflowEllipsis};
`;

const Boolean = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.subText};
`;
