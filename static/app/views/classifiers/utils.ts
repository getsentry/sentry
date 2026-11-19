import {
  BooleanOperator,
  parseSearch,
  TermOperator,
  Token,
  type ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import {escapeDoubleQuotes} from 'sentry/utils';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import type {
  ClassifierDataset,
  ClassifierOutputType,
  ClassifierResultFilter,
  TelemetryClassifier,
} from './types';

export const CLASSIFIER_PREVIEW_PER_PAGE = 10;

export const CLASSIFIER_DETAIL_DEFAULT_SELECTION = {
  datetime: {period: '24h', start: null, end: null, utc: null},
} satisfies Partial<PageFilters>;

export function filterQueryHasEnvironment(filterQuery: string) {
  return new MutableSearch(filterQuery)
    .getTokenKeys()
    .some(key => key?.replace(/^!/, '') === 'environment');
}

export type FilterTreeNode =
  | {key: number; query: string; type: 'filter'}
  | {key: number; options: FilterTreeNode[][]; type: 'any'};

function buildConjunction(tokens: ParseResultToken[]): FilterTreeNode[] {
  return tokens.flatMap<FilterTreeNode>(token => {
    if (token.type === Token.FILTER) {
      return [{type: 'filter', key: token.location.start.offset, query: token.text}];
    }
    if (token.type === Token.FREE_TEXT && token.value.trim()) {
      return [
        {type: 'filter', key: token.location.start.offset, query: token.text.trim()},
      ];
    }
    if (token.type === Token.LOGIC_GROUP) {
      const options = buildDisjunction(token.inner);
      if (options.length > 1) {
        return [{type: 'any', key: token.location.start.offset, options}];
      }
      return options[0] ?? [];
    }
    return [];
  });
}

function buildDisjunction(tokens: ParseResultToken[]): FilterTreeNode[][] {
  let current: ParseResultToken[] = [];
  const groups = [current];
  for (const token of tokens) {
    if (token.type === Token.LOGIC_BOOLEAN && token.value === BooleanOperator.OR) {
      current = [];
      groups.push(current);
    } else {
      current.push(token);
    }
  }
  return groups.map(buildConjunction).filter(conjunction => conjunction.length > 0);
}

export function getFilterTree(filterQuery: string): FilterTreeNode[] | null {
  const tokens = parseSearch(filterQuery);
  if (!tokens) {
    return null;
  }

  const options = buildDisjunction(tokens);
  return options.length > 1 ? [{type: 'any', key: 0, options}] : (options[0] ?? []);
}

function isMeaningfulToken(token: ParseResultToken) {
  return (
    token.type !== Token.SPACES &&
    !(token.type === Token.FREE_TEXT && !token.value.trim())
  );
}

function isBoolean(token: ParseResultToken | undefined, operator: BooleanOperator) {
  return token?.type === Token.LOGIC_BOOLEAN && token.value === operator;
}

function getTextListValues(token: ParseResultToken | undefined, key: string) {
  if (
    token?.type !== Token.FILTER ||
    token.negated ||
    token.operator !== TermOperator.DEFAULT ||
    getKeyName(token.key) !== key ||
    token.value.type !== Token.VALUE_TEXT_LIST
  ) {
    return null;
  }
  return token.value.items.flatMap(item => (item.value ? [item.value.value] : []));
}

function getAgentSelectorValues(token: ParseResultToken | undefined) {
  if (token?.type !== Token.LOGIC_GROUP) {
    return null;
  }
  const inner = token.inner.filter(isMeaningfulToken);
  const agentNames = getTextListValues(inner[0], 'gen_ai.agent.name');
  const functionIds = getTextListValues(inner[2], 'gen_ai.function_id');
  if (
    inner.length !== 3 ||
    !agentNames ||
    !functionIds ||
    !isBoolean(inner[1], BooleanOperator.OR) ||
    agentNames.join('\n') !== functionIds.join('\n')
  ) {
    return null;
  }
  return agentNames;
}

function getSelectorFilters(tokens: ParseResultToken[]) {
  const meaningful = tokens.filter(isMeaningfulToken);
  let index = 0;

  const environments = getTextListValues(meaningful[index], 'environment');
  if (environments) {
    index++;
  }
  const agents = getAgentSelectorValues(meaningful[index]);
  if (agents) {
    index++;
  }

  if (index !== meaningful.length) {
    return null;
  }
  return {environments: environments ?? [], agents: agents ?? []};
}

interface ClassifierFilterParts {
  agents: string[];
  environments: string[];
  query: string;
}

export function getClassifierFilterParts(filterQuery: string): ClassifierFilterParts {
  const tokens = parseSearch(filterQuery)?.filter(isMeaningfulToken);
  if (!tokens) {
    return {environments: [], agents: [], query: filterQuery};
  }

  const [selectorGroup, operator, queryGroup] = tokens;
  if (
    tokens.length === 3 &&
    selectorGroup?.type === Token.LOGIC_GROUP &&
    isBoolean(operator, BooleanOperator.AND) &&
    queryGroup?.type === Token.LOGIC_GROUP
  ) {
    const selectors = getSelectorFilters(selectorGroup.inner);
    if (selectors && (selectors.environments.length || selectors.agents.length)) {
      return {
        ...selectors,
        query: filterQuery
          .slice(queryGroup.location.start.offset + 1, queryGroup.location.end.offset - 1)
          .trim(),
      };
    }
  }

  const selectors = getSelectorFilters(tokens);
  return selectors
    ? {...selectors, query: ''}
    : {environments: [], agents: [], query: filterQuery};
}

export const ENRICHMENT_ATTRIBUTE_PREFIX = 'sentry.enrichment.';

export function getClassifiersPath(organizationSlug: string) {
  return normalizeUrl(`/organizations/${organizationSlug}/seer/classifiers/`);
}

export function getClassifierDetailPath(organizationSlug: string, classifierId: string) {
  return `${getClassifiersPath(organizationSlug)}${classifierId}/`;
}

export function getNewClassifierPath(organizationSlug: string) {
  return `${getClassifiersPath(organizationSlug)}new/`;
}

export function getDatasetLabel(dataset: ClassifierDataset) {
  return dataset === 'conversation' ? t('Conversations') : t('Spans');
}

export function getOutputTypeLabel(outputType: ClassifierOutputType) {
  switch (outputType) {
    case 'binary':
      return t('Binary');
    case 'choice':
      return t('Multiple choice');
    case 'score':
      return t('Score');
    default:
      return outputType;
  }
}

export function getResultAttributeKey(resultAttribute: string) {
  return `${ENRICHMENT_ATTRIBUTE_PREFIX}${resultAttribute}`;
}

export function getResultField(resultAttribute: string) {
  return `tags[${getResultAttributeKey(resultAttribute)},number]`;
}

export function getClassifierResultQuery(
  classifier: Pick<TelemetryClassifier, 'binaryThreshold' | 'resultAttribute'>,
  resultFilter: ClassifierResultFilter
) {
  const resultField = getResultField(classifier.resultAttribute);
  const threshold = classifier.binaryThreshold;
  if (threshold === null || resultFilter === 'all') {
    return `has:${resultField}`;
  }
  return resultFilter === 'matches'
    ? `${resultField}:>=${threshold}`
    : `${resultField}:<${threshold}`;
}

export function isClassifierMatch(
  classifier: Pick<TelemetryClassifier, 'binaryThreshold'>,
  value: number
) {
  return classifier.binaryThreshold !== null && value >= classifier.binaryThreshold;
}

export function getEnvironmentsFilter(environments: readonly string[]) {
  if (environments.length === 0) {
    return '';
  }
  const values = environments.map(value => `"${escapeDoubleQuotes(value)}"`).join(', ');
  return `environment:[${values}]`;
}

export function useClassifiersEnabled() {
  const organization = useOrganization({allowNull: true});
  return !!organization?.features.includes('classifiers-ui');
}
