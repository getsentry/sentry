import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Chip} from '@sentry/scraps/chip';
import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {
  SearchQueryBuilderProvider,
  useSearchQueryBuilderConfig,
} from 'sentry/components/searchQueryBuilder/context';
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
  useCompoundChips?: boolean;
};

type TokenProps = {
  token: ParseResultToken;
  useCompoundChips: boolean;
};

const EMPTY_FILTER_KEYS: TagCollection = {};
const defaultFieldDefinitionGetter: FieldDefinitionGetter = key =>
  defaultGetFieldDefinition(key);

function FilterKey({
  token,
  useCompoundChips,
}: {
  token: TokenResult<Token.FILTER>;
  useCompoundChips: boolean;
}) {
  if (token.filter === FilterType.IS || token.filter === FilterType.HAS) {
    return null;
  }

  const content = isAggregateFilterToken(token) ? (
    <AggregateKeyVisual token={token} />
  ) : (
    getKeyLabel(token.key)
  );

  return useCompoundChips ? (
    <Chip.Property>{content}</Chip.Property>
  ) : (
    <div>{content}</div>
  );
}

function Filter({
  token,
  useCompoundChips,
}: {
  token: TokenResult<Token.FILTER>;
  useCompoundChips: boolean;
}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const label = useMemo(
    () =>
      getOperatorInfo({
        filterToken: token,
        fieldDefinition: getFieldDefinition(token.key.text),
      }).label,
    [token, getFieldDefinition]
  );

  if (useCompoundChips) {
    return (
      <CompoundChipRoot size="sm" aria-label={token.text}>
        <FilterKey token={token} useCompoundChips />
        <Chip.Operator>{label}</Chip.Operator>
        <Chip.Value>
          <FilterValueText token={token} />
        </Chip.Value>
      </CompoundChipRoot>
    );
  }

  return (
    <FilterWrapper aria-label={token.text}>
      <FilterKey token={token} useCompoundChips={false} /> {label}{' '}
      <FilterValue>
        <FilterValueText token={token} />
      </FilterValue>
    </FilterWrapper>
  );
}

function Boolean({
  token,
  useCompoundChips,
}: {
  token: TokenResult<Token.LOGIC_BOOLEAN>;
  useCompoundChips: boolean;
}) {
  const label = token.text.toUpperCase();

  if (useCompoundChips) {
    return (
      <CompoundChipRoot size="sm" aria-label={label}>
        <Chip.Value variant="primary">{label}</Chip.Value>
      </CompoundChipRoot>
    );
  }

  return <Chip size="sm" value={label} aria-label={label} />;
}

function QueryToken({token, useCompoundChips}: TokenProps) {
  switch (token.type) {
    case Token.FILTER:
      return <Filter token={token} useCompoundChips={useCompoundChips} />;
    case Token.FREE_TEXT:
      if (token.value.trim()) {
        return <Text as="span">{token.value.trim()}</Text>;
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
      return <Boolean token={token} useCompoundChips={useCompoundChips} />;
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
  useCompoundChips = false,
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
        return (
          <QueryToken key={index} token={token} useCompoundChips={useCompoundChips} />
        );
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
  fieldDefinitionGetter = defaultFieldDefinitionGetter,
  filterKeys = EMPTY_FILTER_KEYS,
  filterKeyAliases = EMPTY_FILTER_KEYS,
  getFilterTokenWarning,
  useCompoundChips,
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
        useCompoundChips={useCompoundChips}
      />
    </SearchQueryBuilderProvider>
  );
}

function QueryWrapper(props: FlexProps) {
  return <Flex {...props} align="center" wrap="wrap" gap="xs md" />;
}

export function FilterWrapper(props: FlexProps) {
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
      height="24px"
      maxWidth="100%"
      whiteSpace="nowrap"
      overflow="hidden"
    />
  );
}

const FilterValue = styled('div')`
  max-width: 300px;
  min-width: 0;
  color: ${p => p.theme.tokens.content.accent};
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
`;

const CompoundChipRoot = styled(Chip.Root)`
  min-width: 0;
  max-width: 100%;

  & > * {
    min-width: 0;
    overflow: hidden;
  }

  & > :last-child {
    max-width: 300px;
  }

  & > :last-child > * {
    min-width: 0;
    width: 100%;
  }
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
