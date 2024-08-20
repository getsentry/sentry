import {useMemo} from 'react';
import styled from '@emotion/styled';

import {FilterValueText} from 'sentry/components/searchQueryBuilder/tokens/filter/filter';
import {FilterKeyOperatorVisual} from 'sentry/components/searchQueryBuilder/tokens/filter/filterKeyOperator';
import {SearchQueryBuilderParenIcon} from 'sentry/components/searchQueryBuilder/tokens/paren';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  type ParseResultToken,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {getFieldDefinition} from 'sentry/utils/fields';

export type FormattedQueryProps = {
  query: string;
  fieldDefinitionGetter?: FieldDefinitionGetter;
  filterKeys?: TagCollection;
};

type TokenProps = {
  token: ParseResultToken;
};

const EMPTY_FILTER_KEYS: TagCollection = {};

function Filter({token}: {token: TokenResult<Token.FILTER>}) {
  return (
    <FilterWrapper aria-label={token.text}>
      <FilterKeyOperatorVisual token={token} />{' '}
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
  query,
  fieldDefinitionGetter = getFieldDefinition,
  filterKeys = EMPTY_FILTER_KEYS,
}: FormattedQueryProps) {
  const parsedQuery = useMemo(() => {
    return parseQueryBuilderValue(query, fieldDefinitionGetter, {filterKeys});
  }, [fieldDefinitionGetter, filterKeys, query]);

  if (!parsedQuery) {
    return <QueryWrapper />;
  }

  return (
    <QueryWrapper aria-label={query}>
      {parsedQuery.map((token, index) => {
        return <QueryToken key={index} token={token} />;
      })}
    </QueryWrapper>
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
  display: grid;
  grid-template-columns: auto 1fr;
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
