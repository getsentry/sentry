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
import {
  getFilterValueDisplayParts,
  isAggregateFilterToken,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {SearchQueryBuilderParenIcon} from 'sentry/components/searchQueryBuilder/tokens/paren';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {parseQueryBuilderValue} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  Token,
  type ParseResultToken,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyLabel, getKeyName} from 'sentry/components/searchSyntax/utils';
import type {TagCollection} from 'sentry/types/group';
import {getFieldDefinition as defaultGetFieldDefinition} from 'sentry/utils/fields';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

export type FormattedQueryProps = {
  query: string;
  className?: string;
  fieldDefinitionGetter?: FieldDefinitionGetter;
  filterKeyAliases?: TagCollection;
  filterKeys?: TagCollection;
  filterRenderer?: 'chip' | 'formatted';
  getFilterTokenWarning?: (key: string) => React.ReactNode;
};

type TokenProps = {
  filterRenderer: NonNullable<FormattedQueryProps['filterRenderer']>;
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

function FormattedFilter({token}: {token: TokenResult<Token.FILTER>}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const label = useMemo(
    () =>
      getOperatorInfo({
        filterToken: token,
        fieldDefinition: getFieldDefinition(token.key.text),
      }).label,
    [token, getFieldDefinition]
  );

  return (
    <FilterWrapper aria-label={token.text}>
      <FilterKey token={token} /> {label}{' '}
      <FilterValue>
        <FilterValueText token={token} />
      </FilterValue>
    </FilterWrapper>
  );
}

const FILTER_VALUE_MAX_LENGTH = 40;
const FILTER_VALUE_ELLIPSIS_DELIMITER = /[\s\-:/]/;

function getChipFilterProperty(
  token: TokenResult<Token.FILTER>,
  operatorLabel: string
): string {
  if (token.filter === FilterType.HAS) {
    return operatorLabel;
  }
  if (token.filter === FilterType.IS) {
    return token.key.text;
  }
  return isAggregateFilterToken(token)
    ? getKeyName(token.key, {aggregateWithArgs: true})
    : getKeyLabel(token.key);
}

function getChipFilterValue(
  token: TokenResult<Token.FILTER>,
  fieldDefinition: ReturnType<FieldDefinitionGetter>
): string {
  const display = getFilterValueDisplayParts({
    token,
    fieldDefinition,
    maxItems: 3,
  });
  let value = display.values.join(display.joiner ? ` ${display.joiner} ` : '');

  if (display.overflowCount) {
    value += ` +${display.overflowCount}`;
  }

  return middleEllipsis(value, FILTER_VALUE_MAX_LENGTH, FILTER_VALUE_ELLIPSIS_DELIMITER);
}

function ChipFilter({token}: {token: TokenResult<Token.FILTER>}) {
  const {getFieldDefinition} = useSearchQueryBuilderConfig();
  const fieldDefinition = getFieldDefinition(getKeyName(token.key));
  const {labelText: operatorLabel} = getOperatorInfo({
    filterToken: token,
    fieldDefinition,
  });

  return (
    <Chip
      size="sm"
      property={getChipFilterProperty(token, operatorLabel)}
      operator={token.filter === FilterType.HAS ? undefined : operatorLabel || undefined}
      value={getChipFilterValue(token, fieldDefinition)}
      aria-label={token.text}
    />
  );
}

function Boolean({token}: {token: TokenResult<Token.LOGIC_BOOLEAN>}) {
  const label = token.text.toUpperCase();
  return <Chip size="sm" value={label} aria-label={label} />;
}

function QueryToken({token, filterRenderer}: TokenProps) {
  switch (token.type) {
    case Token.FILTER:
      return filterRenderer === 'chip' ? (
        <ChipFilter token={token} />
      ) : (
        <FormattedFilter token={token} />
      );
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
  filterRenderer = 'formatted',
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
        return <QueryToken key={index} token={token} filterRenderer={filterRenderer} />;
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
  filterRenderer = 'formatted',
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
        filterRenderer={filterRenderer}
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
