import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Stack} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {
  parseSearch,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import {StatusCheckRuleForm} from './statusCheckRuleForm';
import type {StatusCheckFilter, StatusCheckRule} from './types';
import {getMeasurementLabel, getMetricLabel} from './types';

interface Props {
  onDelete: () => void;
  onSave: (rule: StatusCheckRule) => void;
  rule: StatusCheckRule;
  defaultExpanded?: boolean;
}

function FilterSummary({filters}: {filters: StatusCheckFilter[]}) {
  const grouped = groupFiltersByKey(filters);

  return (
    <Text size="sm" variant="muted" as="div">
      {Object.entries(grouped).map(([groupKey, groupFilters], groupIdx) => {
        const {key, negated} = groupFilters[0]!;
        const keyLabel = key.replace('build.', '');
        return (
          <Fragment key={groupKey}>
            {groupIdx > 0 && ' • '}
            {negated && <BoldText>NOT </BoldText>}
            {groupFilters.map((f, idx) => (
              <Fragment key={`${f.key}-${f.value}-${idx}`}>
                {idx > 0 && <BoldText> OR </BoldText>}
                {f.value}
              </Fragment>
            ))}{' '}
            ({keyLabel})
          </Fragment>
        );
      })}
    </Text>
  );
}

export function StatusCheckRuleItem({
  rule,
  onSave,
  onDelete,
  defaultExpanded = false,
}: Props) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const filters = parseFiltersForDisplay(rule.filterQuery);

  const valueWithUnit =
    rule.unit === '%' ? `${rule.value}%` : `${rule.value} ${rule.unit}`;
  const title = `${getMetricLabel(rule.metric)} • ${getMeasurementLabel(rule.measurement)} • ${valueWithUnit}`;

  return (
    <ItemContainer>
      <ItemHeader onClick={() => setIsExpanded(!isExpanded)}>
        <Stack gap="2xs">
          <Text size="md" bold>
            {title}
          </Text>
          {filters.length > 0 && <FilterSummary filters={filters} />}
        </Stack>
        <IconChevron direction={isExpanded ? 'up' : 'down'} size="sm" />
      </ItemHeader>
      {isExpanded && (
        <ItemContent>
          <StatusCheckRuleForm
            key={rule.id}
            rule={rule}
            onSave={onSave}
            onDelete={onDelete}
          />
        </ItemContent>
      )}
    </ItemContainer>
  );
}

const ItemContainer = styled('div')`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &:last-child {
    border-bottom: none;
  }
`;

const ItemHeader = styled('button')`
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: ${space(2)} ${space(2)};
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;

const ItemContent = styled('div')`
  padding: 0 ${space(2)} ${space(2)} ${space(2)};
`;

const BoldText = styled('span')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

function splitMultiValue(valueText: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (const char of valueText) {
    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
    } else if (char === ',' && !inQuotes) {
      if (current.trim()) {
        values.push(current.trim());
      }
      current = '';
    } else {
      current += char;
    }
  }

  if (current.trim()) {
    values.push(current.trim());
  }

  return values;
}

function parseFiltersForDisplay(query: string | undefined): StatusCheckFilter[] {
  if (!query?.trim()) {
    return [];
  }
  const parsed = parseSearch(query);
  if (!parsed) {
    return [];
  }
  const filters: StatusCheckFilter[] = [];

  parsed
    .filter((token): token is TokenResult<Token.FILTER> => token.type === Token.FILTER)
    .forEach(token => {
      const valueText = token.value.text;

      if (valueText.startsWith('[') && valueText.endsWith(']')) {
        const values = splitMultiValue(valueText.slice(1, -1));
        values.forEach(value => {
          filters.push({
            key: token.key.text,
            value,
            negated: token.negated || false,
          });
        });
      } else {
        filters.push({
          key: token.key.text,
          value: valueText,
          negated: token.negated || false,
        });
      }
    });

  return filters;
}

function groupFiltersByKey(filters: StatusCheckFilter[]) {
  return filters.reduce(
    (acc, filter) => {
      const groupKey = `${filter.key}:${filter.negated ? 'negated' : 'normal'}`;
      if (!acc[groupKey]) {
        acc[groupKey] = [];
      }
      acc[groupKey].push(filter);
      return acc;
    },
    {} as Record<string, StatusCheckFilter[]>
  );
}
