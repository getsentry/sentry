import {Fragment, useMemo, useRef, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {IconClose} from '@sentry/icons/close';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import type {ModalRenderProps} from '@sentry/scraps/modal';
import {openModal} from '@sentry/scraps/modal';
import {Heading, Text} from '@sentry/scraps/text';
import {toast} from '@sentry/scraps/toast';

import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Placeholder} from 'sentry/components/placeholder';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {
  escapeTagValue,
  escapeTagValueForSearch,
  formatFilterValue,
  unescapeAsteriskSearchValue,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import type {FieldDefinitionGetter} from 'sentry/components/searchQueryBuilder/types';
import {
  parseQueryBuilderValue,
  queryIsValid,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  defaultConfig,
  InvalidReason,
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {TimeSince} from 'sentry/components/timeSince';
import {android, gaming, sourceMaps} from 'sentry/data/platformCategories';
import {t, tct} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import type {EventsStats, Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

// Condition types accepted by the custom inbound filters API. The values match
// the `type` field on the backend serializer exactly. `CONDITIONS` below
// describes each one, and the compiler requires a row per member.
type ConditionType =
  | 'error_message'
  | 'error_type'
  | 'geo_country_code'
  | 'metric_name'
  | 'log_message'
  | 'release'
  | 'environment'
  | 'ip_address';

// How a condition compares its values to the field, as the API names it. `glob`
// matches each value as a glob pattern. The literal operators read every character
// of a value as itself. `cidr` matches an IP address against addresses and ranges,
// `not_cidr` one that none covers. The ordered operators compare a release as a
// version. A condition matches when any value does, except under a negated
// operator, which matches when none does.
export type ConditionOperator =
  | 'glob'
  | 'equals'
  | 'starts_with'
  | 'contains'
  | 'ends_with'
  | 'does_not_start_with'
  | 'does_not_contain'
  | 'does_not_end_with'
  | 'cidr'
  | 'not_cidr'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte';

export type CustomInboundFilterCondition = {
  type: ConditionType;
  value: string[];
  // Absent on a filter stored before operators existed. Such a condition holds
  // raw values: glob patterns, or addresses and ranges on `ip_address`.
  operator?: ConditionOperator;
};

// Shape returned by the custom inbound filters API.
export type CustomInboundFilter = {
  active: boolean;
  conditions: CustomInboundFilterCondition[];
  dateCreated: string;
  dateUpdated: string;
  id: string;
  name: string | null;
  // Absent until the API stores the data type on the filter.
  dataType?: FilterDataType;
  // Set once a legacy newline list of the project settings moves into the table: the
  // id Relay reports the outcomes of that list under. The row keeps one condition
  // whose values are the lines of the list. Absent on a filter made here.
  legacyFilter?: string;
};

// The body of the validate endpoint: a filter without its name, which is what the
// name suggestion fills in. `id` names the stored filter an edit replaces.
type CustomInboundFilterDraft = {
  conditions: CustomInboundFilterCondition[];
  dataType: FilterDataType;
  id?: string;
};

type CustomInboundFilterValidation = {
  errors: Record<string, unknown>;
  suggestedName: string | null;
};

type PropertyOption = {label: string; value: ConditionType};

// The data a filter matches against. It decides which condition properties the
// filter can use. `all` is the catch-all: it matches every data type, so it takes only
// the properties every data type carries a field for.
type FilterDataType = 'all' | 'error' | 'metric' | 'log' | 'span';

type DataTypeOption = {label: string; value: FilterDataType};

// The modal edits the conditions as one text. See `ConditionEditor` for how the
// text translates.
type FilterFormValues = {
  conditions: string;
  dataType: FilterDataType;
  name: string;
};

type DataTypeSpec = {
  label: string;
  // Ingestion feature the org needs before the API accepts a filter on this data
  // type. Offering a data type without it lets the user build a filter the API
  // rejects on save, so mirror the gating here.
  feature?: string;
  // Shown in the filter table, whose data type column already says "Data Type".
  tableLabel?: string;
};

// Declaration order is the order of the data type dropdown.
const DATA_TYPES: Record<FilterDataType, DataTypeSpec> = {
  all: {label: t('All Data Types'), tableLabel: t('All')},
  error: {label: t('Errors')},
  metric: {label: t('Metrics'), feature: 'tracemetrics-ingestion'},
  log: {label: t('Logs'), feature: 'ourlogs-ingestion'},
  span: {label: t('Spans')},
};

type ConditionSpec = {
  // Names the field the condition matches. `release` sits on a different field
  // per data type, so its description depends on the filter's data type.
  description: string | Record<FilterDataType, string>;
  label: string;
  placeholder: string;
  // Values compare as versions too, so the query builder offers >, >=, < and <=.
  comparable?: boolean;
  // The data type whose field this condition reads. Absent for `release`,
  // `environment` and `ip_address`, which every data type carries, so they stay
  // on offer whatever the filter targets.
  dataType?: FilterDataType;
  // Values are addresses and ranges, not text: the field "matches" them or "does
  // not match" them, and the query builder offers no wildcard.
  exact?: boolean;
};

// Declaration order is the order of the key menu. Keep the conditions every data
// type carries last, `release` first among them.
const CONDITIONS: Record<ConditionType, ConditionSpec> = {
  error_message: {
    dataType: 'error',
    label: t('Error Message'),
    placeholder: t('Glob pattern, e.g. *connection refused*'),
    description: t(
      'Matches the exception message of an error, without the exception type. Also matches errors captured as a plain message.'
    ),
  },
  error_type: {
    dataType: 'error',
    label: t('Error Type'),
    placeholder: t('Glob pattern, e.g. TypeError'),
    description: t(
      'Matches the exception type of an error, e.g. TypeError. Use an Error Message condition to match the message.'
    ),
  },
  geo_country_code: {
    dataType: 'error',
    label: t('Country'),
    placeholder: t('Glob pattern, e.g. US'),
    description: t(
      "Matches the two-letter country code of the user's location, e.g. US. Sentry derives it from the sender IP address unless the SDK sets one."
    ),
  },
  metric_name: {
    dataType: 'metric',
    label: t('Metric Name'),
    placeholder: t('Glob pattern, e.g. checkout.*'),
    description: t('Matches the name of the metric.'),
  },
  log_message: {
    dataType: 'log',
    label: t('Log Message'),
    placeholder: t('Glob pattern, e.g. *DEBUG*'),
    description: t('Matches the body of the log.'),
  },
  release: {
    comparable: true,
    label: t('Release'),
    placeholder: t('Glob pattern, e.g. 2.41.*'),
    description: {
      all: t('Matches the release of any data type.'),
      error: t('Matches the release of the error.'),
      log: t('Matches the release attribute of the log.'),
      metric: t('Matches the release attribute of the metric.'),
      span: t('Matches the release attribute of the span.'),
    },
  },
  environment: {
    label: t('Environment'),
    placeholder: t('Glob pattern, e.g. staging'),
    description: {
      all: t('Matches the environment of any data type.'),
      error: t('Matches the environment of the error.'),
      log: t('Matches the environment attribute of the log.'),
      metric: t('Matches the environment attribute of the metric.'),
      span: t('Matches the environment attribute of the span.'),
    },
  },
  ip_address: {
    exact: true,
    label: t('IP Address'),
    placeholder: t('IP address or CIDR range, e.g. 203.0.113.7 or 10.0.0.0/8'),
    description: t(
      'Matches the IP address the data was sent from against single addresses and CIDR ranges, e.g. 203.0.113.7 or 10.0.0.0/8.'
    ),
  },
};

const CONDITION_TYPES = Object.keys(CONDITIONS) as [ConditionType, ...ConditionType[]];
const FILTER_DATA_TYPES = Object.keys(DATA_TYPES) as [
  FilterDataType,
  ...FilterDataType[],
];

// Reads go through a map because a stored filter may name a condition type this
// revision does not know, e.g. one a newer deploy added. Such a condition keeps
// its row in the table and gets a generic description, instead of breaking it.
const CONDITION_SPECS = new Map<string, ConditionSpec>(Object.entries(CONDITIONS));

export function getCondition(property: string): ConditionSpec {
  return (
    CONDITION_SPECS.get(property) ?? {
      label: property,
      placeholder: t('Glob pattern'),
      description: '',
    }
  );
}

// A data type offers the conditions that read its own fields, plus the ones every
// data type carries. The catch-all offers only the latter.
function getPropertyOptions(dataType: FilterDataType): PropertyOption[] {
  return CONDITION_TYPES.filter(value => {
    const owner = getCondition(value).dataType;
    return owner === undefined || owner === dataType;
  }).map(value => ({value, label: getCondition(value).label}));
}

// The query builder reads conditions as search filter keys. Each data type gets its
// own stable key set, since the builder re-parses whenever the reference changes.
const FILTER_KEYS = new Map<FilterDataType, TagCollection>();

function getFilterKeys(dataType: FilterDataType): TagCollection {
  let keys = FILTER_KEYS.get(dataType);
  if (!keys) {
    keys = Object.fromEntries(
      getPropertyOptions(dataType).map(({value}) => [
        value,
        {key: value, name: value, kind: FieldKind.FIELD},
      ])
    );
    FILTER_KEYS.set(dataType, keys);
  }
  return keys;
}

// The environment condition rolls out behind its own flag, so the key menu leaves
// it out until the organization has it. Parsing still reads it, so a filter that
// already holds one stays editable.
const FILTER_KEYS_WITHOUT_ENVIRONMENT = new Map<FilterDataType, TagCollection>();

function getOfferedFilterKeys(
  dataType: FilterDataType,
  hasEnvironmentCondition: boolean
): TagCollection {
  const keys = getFilterKeys(dataType);
  if (hasEnvironmentCondition) {
    return keys;
  }
  let offered = FILTER_KEYS_WITHOUT_ENVIRONMENT.get(dataType);
  if (!offered) {
    const {environment: _environment, ...rest} = keys;
    offered = rest;
    FILTER_KEYS_WITHOUT_ENVIRONMENT.set(dataType, offered);
  }
  return offered;
}

const FIELD_DEFINITION_GETTERS = new Map<FilterDataType, FieldDefinitionGetter>();

// An address field matches a value or does not; "is" would read as text equality.
const EXACT_OPERATOR_LABELS: Partial<Record<TermOperator, string>> = {
  [TermOperator.DEFAULT]: t('matches'),
  [TermOperator.NOT_EQUAL]: t('does not match'),
};

// The API has no "is not" for text. The menu offers the three "does not" operators
// instead, and `tokenToCondition` refuses an "is not" typed as text.
const TEXT_DISALLOWED_OPERATORS = [TermOperator.NOT_EQUAL] as const;

// What the value dropdown says a value is under the operator. A wildcard operator
// keeps the builder's own hint, which says how to get a wildcard back.
function getValueHint(spec: ConditionSpec, operator: TermOperator): string | undefined {
  if (spec.exact) {
    return t('An IP address or a CIDR range, e.g. 203.0.113.7 or 10.0.0.0/8');
  }
  const conditionOperator = TERM_OPERATORS[operator];
  if (conditionOperator && COMPARISON_OPERATORS.has(conditionOperator)) {
    return t('A release with a version, e.g. 1.2.0 or myapp@1.2.0');
  }
  if (operator === TermOperator.DEFAULT || operator === TermOperator.EQUAL) {
    return t('The exact text, or a pattern with * as a wildcard');
  }
  return undefined;
}

// Tells the query builder which operators a condition takes and what it matches.
// The description shows in the key menu.
function getFieldDefinitionGetter(dataType: FilterDataType): FieldDefinitionGetter {
  let getter = FIELD_DEFINITION_GETTERS.get(dataType);
  if (!getter) {
    getter = key => {
      const spec = CONDITION_SPECS.get(key);
      if (!spec) {
        return null;
      }
      return {
        kind: FieldKind.FIELD,
        valueType: FieldValueType.STRING,
        desc: getMatchDescription(key, dataType),
        allowComparisonOperators: spec.comparable,
        comparisonOperatorsFirst: spec.comparable,
        allowWildcard: !spec.exact,
        disallowWildcardOperators: spec.exact,
        disallowedOperators: spec.exact ? undefined : TEXT_DISALLOWED_OPERATORS,
        operatorLabels: spec.exact ? EXACT_OPERATOR_LABELS : undefined,
        valueHint: operator => getValueHint(spec, operator),
      };
    };
    FIELD_DEFINITION_GETTERS.set(dataType, getter);
  }
  return getter;
}

// The query builder operators that name an API operator outright. "is" is missing
// on purpose: it reads as `glob` or `equals` by its values, see `tokenToCondition`.
const TERM_OPERATORS: Partial<Record<TermOperator, ConditionOperator>> = {
  [TermOperator.CONTAINS]: 'contains',
  [TermOperator.STARTS_WITH]: 'starts_with',
  [TermOperator.ENDS_WITH]: 'ends_with',
  [TermOperator.DOES_NOT_CONTAIN]: 'does_not_contain',
  [TermOperator.DOES_NOT_START_WITH]: 'does_not_start_with',
  [TermOperator.DOES_NOT_END_WITH]: 'does_not_end_with',
  [TermOperator.GREATER_THAN]: 'gt',
  [TermOperator.GREATER_THAN_EQUAL]: 'gte',
  [TermOperator.LESS_THAN]: 'lt',
  [TermOperator.LESS_THAN_EQUAL]: 'lte',
};

// The query text that puts a condition under its operator, before the value. A
// negated operator is its positive one on a `!` key, which is how the search
// syntax writes it.
const OPERATOR_PREFIXES: Record<ConditionOperator, string> = {
  glob: '',
  equals: '',
  cidr: '',
  not_cidr: '',
  contains: TermOperator.CONTAINS,
  starts_with: TermOperator.STARTS_WITH,
  ends_with: TermOperator.ENDS_WITH,
  does_not_contain: TermOperator.CONTAINS,
  does_not_start_with: TermOperator.STARTS_WITH,
  does_not_end_with: TermOperator.ENDS_WITH,
  gt: TermOperator.GREATER_THAN,
  gte: TermOperator.GREATER_THAN_EQUAL,
  lt: TermOperator.LESS_THAN,
  lte: TermOperator.LESS_THAN_EQUAL,
};

const COMPARISON_OPERATORS = new Set<ConditionOperator>(['gt', 'gte', 'lt', 'lte']);

export const NEGATED_OPERATORS = new Set<ConditionOperator>([
  'does_not_contain',
  'does_not_start_with',
  'does_not_end_with',
  'not_cidr',
]);

// The operators whose values go into the query as stored, since the builder reads
// them as the user wrote them: a glob keeps its stars, an address its slash.
const RAW_OPERATORS = new Set<ConditionOperator>(['glob', 'cidr', 'not_cidr']);

// How the table names an operator. A glob stays implicit, as before operators
// existed: the pattern speaks for itself.
export const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  glob: '',
  cidr: t('matches'),
  not_cidr: t('does not match'),
  equals: t('is'),
  contains: t('contains'),
  starts_with: t('starts with'),
  ends_with: t('ends with'),
  does_not_contain: t('does not contain'),
  does_not_start_with: t('does not start with'),
  does_not_end_with: t('does not end with'),
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
};

// The operator a stored condition without one reads as.
export function getConditionOperator(
  condition: CustomInboundFilterCondition
): ConditionOperator {
  return condition.operator ?? (condition.type === 'ip_address' ? 'cidr' : 'glob');
}

// `*` is the wildcard of the search syntax, so a value with one is a glob pattern;
// `\*` is a literal star. The other glob characters, `?` and brackets, are plain
// text to the search syntax and to the user, so a value with them reads literally.
function isGlob(value: string): boolean {
  return /(^|[^\\])(\\\\)*\*/.test(value);
}

// The builder parses "does not contain" as "contains" with a negation flag.
function negate(operator: TermOperator): TermOperator | undefined {
  switch (operator) {
    case TermOperator.CONTAINS:
      return TermOperator.DOES_NOT_CONTAIN;
    case TermOperator.STARTS_WITH:
      return TermOperator.DOES_NOT_START_WITH;
    case TermOperator.ENDS_WITH:
      return TermOperator.DOES_NOT_END_WITH;
    default:
      return undefined;
  }
}

type TokenTranslation =
  | {condition: CustomInboundFilterCondition; problem?: undefined}
  | {problem: string; condition?: undefined};

// Translates one filter token of the query into an API condition, or says why the
// API would refuse it: "is not" on text has no API operator.
function tokenToCondition(token: TokenResult<Token.FILTER>): TokenTranslation {
  const type = getKeyName(token.key);
  const spec = CONDITION_SPECS.get(type);
  if (!spec) {
    return {problem: t('%s is not a condition.', type)};
  }
  const values =
    token.value.type === Token.VALUE_TEXT_LIST
      ? token.value.items.flatMap(item =>
          item.value ? [formatFilterValue({token: item.value})] : []
        )
      : [formatFilterValue({token: token.value})];

  const termOperator = token.negated
    ? (negate(token.operator) ?? TermOperator.NOT_EQUAL)
    : token.operator;
  const literals = values.map(unescapeAsteriskSearchValue);

  if (spec.exact) {
    if (termOperator === TermOperator.DEFAULT || termOperator === TermOperator.EQUAL) {
      return {condition: {type: type as ConditionType, operator: 'cidr', value: values}};
    }
    if (termOperator === TermOperator.NOT_EQUAL) {
      return {
        condition: {type: type as ConditionType, operator: 'not_cidr', value: values},
      };
    }
    return {problem: t('%s only takes "matches" and "does not match".', type)};
  }

  if (termOperator === TermOperator.DEFAULT || termOperator === TermOperator.EQUAL) {
    return values.some(isGlob)
      ? {condition: {type: type as ConditionType, operator: 'glob', value: values}}
      : {condition: {type: type as ConditionType, operator: 'equals', value: literals}};
  }

  const operator = TERM_OPERATORS[termOperator];
  if (!operator || (COMPARISON_OPERATORS.has(operator) && !spec.comparable)) {
    return {
      problem: t(
        '%s does not take "is not". Use "does not contain", "does not start with" or "does not end with".',
        type
      ),
    };
  }
  return {condition: {type: type as ConditionType, operator, value: literals}};
}

type ConditionsTranslation =
  | {conditions: CustomInboundFilterCondition[]; problem?: undefined}
  | {problem: string; conditions?: undefined};

// Translates the modal's search query into API conditions, one per filter token.
// Tokens AND together, as conditions do. Says why instead when the query has no
// condition or one the API would reject: free text, OR, parens, an unknown key, or
// a token `tokenToCondition` refuses.
function parseConditionQuery(
  query: string,
  dataType: FilterDataType
): ConditionsTranslation {
  const parsed = parseQueryBuilderValue(query, getFieldDefinitionGetter(dataType), {
    filterKeys: getFilterKeys(dataType),
    disallowFreeText: true,
    disallowLogicalOperators: true,
    disallowUnsupportedFilters: true,
  });
  if (!queryIsValid(parsed)) {
    return {problem: t('Every condition must be valid.')};
  }
  const conditions: CustomInboundFilterCondition[] = [];
  for (const token of parsed ?? []) {
    if (token.type !== Token.FILTER) {
      continue;
    }
    const translation = tokenToCondition(token);
    if (translation.condition === undefined) {
      return translation;
    }
    conditions.push(translation.condition);
  }
  if (conditions.length === 0) {
    return {problem: t('Add at least one condition.')};
  }
  return {conditions};
}

// A raw value goes into the query as the user wrote it, so its stars keep their
// meaning. A literal value escapes its stars, so the builder reads them as text.
function formatValue(value: string, raw: boolean): string {
  return raw ? escapeTagValue(value) : escapeTagValueForSearch(value);
}

// The search filter token that compares `key` the way the condition compares its
// field. The modal's query names the condition type as the key.
function conditionToToken(
  condition: CustomInboundFilterCondition,
  key: string = condition.type
): string {
  const operator = getConditionOperator(condition);
  const values = condition.value.map(value =>
    formatValue(value, RAW_OPERATORS.has(operator))
  );
  const text = values.length === 1 ? values[0]! : `[${values.join(',')}]`;
  const negation = NEGATED_OPERATORS.has(operator) ? '!' : '';
  return `${negation}${key}:${OPERATOR_PREFIXES[operator]}${text}`;
}

function conditionsToQuery(conditions: CustomInboundFilterCondition[]): string {
  return conditions.map(condition => conditionToToken(condition)).join(' ');
}

// Conditions match patterns the user writes, so there are no values to suggest.
function getNoTagValues(): Promise<string[]> {
  return Promise.resolve([]);
}

const CONDITION_QUERY_MESSAGES = {
  ...defaultConfig.invalidMessages,
  [InvalidReason.FREE_TEXT_NOT_ALLOWED]: t(
    'Start with a property, e.g. error_message:*timeout*'
  ),
  [InvalidReason.LOGICAL_AND_NOT_ALLOWED]: t('Conditions already combine with AND.'),
  [InvalidReason.LOGICAL_OR_NOT_ALLOWED]: t(
    'OR is not supported. List several values on one property instead.'
  ),
};

function dataTypeOption(value: FilterDataType): DataTypeOption {
  return {value, label: DATA_TYPES[value].label};
}

function getAvailableDataTypeOptions(organization: Organization): DataTypeOption[] {
  return FILTER_DATA_TYPES.filter(value => {
    const feature = DATA_TYPES[value].feature;
    return !feature || organization.features.includes(feature);
  }).map(dataTypeOption);
}

// How the modal edits the conditions as one text. `format` renders the stored
// conditions for editing and `parse` reads the edited text back, or says why the
// API would reject it.
type ConditionEditor = {
  format: (conditions: CustomInboundFilterCondition[]) => string;
  parse: (text: string, dataType: FilterDataType) => ConditionsTranslation;
};

// A filter made here edits its conditions as a search query, one filter token per
// condition. See `parseConditionQuery` for the translation.
const QUERY_EDITOR: ConditionEditor = {
  format: conditionsToQuery,
  parse: parseConditionQuery,
};

// A row that holds a legacy list edits the lines of its one condition, one pattern
// per line, the way the project settings edit the list. The condition keeps its
// type and its raw operator, since the legacy API still maps the list onto it.
// Lines are trimmed and blank ones dropped, as the legacy API does.
function getLineListEditor(condition: CustomInboundFilterCondition): ConditionEditor {
  return {
    format: conditions => (conditions[0]?.value ?? []).join('\n'),
    parse: text => {
      const value = text
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean);
      if (value.length === 0) {
        return {problem: t('Enter at least one pattern.')};
      }
      return {
        conditions: [{...condition, operator: getConditionOperator(condition), value}],
      };
    },
  };
}

function getConditionEditor(
  legacyCondition: CustomInboundFilterCondition | undefined
): ConditionEditor {
  return legacyCondition ? getLineListEditor(legacyCondition) : QUERY_EDITOR;
}

function getFilterSchema(editor: ConditionEditor) {
  return z
    .object({
      name: z.string().trim().min(1, t('Give the filter a name')),
      dataType: z.enum(FILTER_DATA_TYPES),
      conditions: z.string(),
    })
    .superRefine((values, ctx) => {
      const {problem} = editor.parse(values.conditions, values.dataType);
      if (problem) {
        ctx.addIssue({code: 'custom', path: ['conditions'], message: problem});
      }
    });
}

// An API that does not store the data type derives it the way the old backend did:
// from the first condition that belongs to one, falling back to errors.
function getFilterDataType(filter: CustomInboundFilter): FilterDataType {
  return (
    filter.dataType ??
    filter.conditions
      .map(condition => getCondition(condition.type).dataType)
      .find(Boolean) ??
    'error'
  );
}

export function getDataTypeLabel(filter: CustomInboundFilter): string {
  const dataType = getFilterDataType(filter);
  const spec = DATA_TYPES[dataType];
  return spec?.tableLabel ?? spec?.label ?? dataType;
}

function filterToFormValues(
  filter: CustomInboundFilter,
  editor: ConditionEditor
): FilterFormValues {
  return {
    name: filter.name ?? '',
    dataType: getFilterDataType(filter),
    conditions: editor.format(filter.conditions),
  };
}

// The draft a name suggestion describes, or undefined while the text does not
// translate to conditions yet: the API refuses such a draft, so there is nothing to
// describe.
function getCompleteDraft(
  editor: ConditionEditor,
  values: FilterFormValues,
  filterId: string | undefined
): CustomInboundFilterDraft | undefined {
  const {conditions} = editor.parse(values.conditions, values.dataType);
  if (!conditions) {
    return undefined;
  }
  return {id: filterId, dataType: values.dataType, conditions};
}

// The API answers with either `{detail: string}` or a DRF validation error, which
// nests messages under field names and list indexes, e.g.
// `{conditions: [{}, {value: ['... is not an IP address or CIDR range.']}]}`. Both
// shapes have their messages as string leaves.
function collectErrorMessages(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(collectErrorMessages);
  }
  if (value && typeof value === 'object') {
    return Object.values(value).flatMap(collectErrorMessages);
  }
  return [];
}

export function getErrorDetail(error: unknown, fallback: string): string {
  if (!(error instanceof RequestError)) {
    return fallback;
  }
  const messages = [...new Set(collectErrorMessages(error.responseJSON))];
  return messages.length > 0 ? messages.join(' ') : fallback;
}

function getMatchDescription(property: string, dataType: FilterDataType): string {
  const {description} = getCondition(property);
  return typeof description === 'string' ? description : description[dataType];
}

// An existing filter may target a data type whose ingestion feature is now
// off, so it's missing from the available options. Keep the stored option
// available so the select can still display and retain it.
function getModalDataTypeOptions(
  availableOptions: DataTypeOption[],
  storedDataType: FilterDataType | undefined
): DataTypeOption[] {
  if (
    !storedDataType ||
    availableOptions.some(option => option.value === storedDataType)
  ) {
    return availableOptions;
  }
  return FILTER_DATA_TYPES.filter(
    value =>
      value === storedDataType ||
      availableOptions.some(available => available.value === value)
  ).map(dataTypeOption);
}

// Conditions that read fields Sentry rewrites after ingestion on obfuscated
// platforms, which is what the warning in the modal is about.
const RAW_ERROR_PROPERTIES = new Set<string>(['error_message', 'error_type']);

// Project platforms that usually ship obfuscated code, so their error type and
// message change once Sentry applies source maps, ProGuard mappings, or debug
// files. This is a guess from the project setting: the backend decides per event
// from its payload, so the list only picks who sees the warning.
const OBFUSCATED_PLATFORMS = new Set<PlatformKey>([
  ...sourceMaps,
  ...android,
  ...gaming,
  'capacitor',
  'dart-flutter',
  'flutter',
  'ionic',
  'javascript-capacitor',
  'javascript-cordova',
  'minidump',
  'native-breakpad',
  'native-crashpad',
  'native-minidump',
  'native-qt',
]);

const OBFUSCATED_ERRORS_DOCS_URL =
  'https://docs.sentry.io/concepts/data-management/filtering/#error-message-filters-do-not-match-deobfuscated-exception-types';

// Inbound filters run before symbolication, so a pattern copied from an issue on
// an obfuscated platform misses the raw type and message the filter checks.
function ObfuscatedErrorWarning({project}: {project: Project}) {
  if (!project.platform || !OBFUSCATED_PLATFORMS.has(project.platform)) {
    return null;
  }

  return (
    <Alert variant="warning">
      {tct(
        'Filters check the error type and message as they arrive, before Sentry applies source maps, ProGuard mappings, or debug files. What you see in an issue can differ from what the filter checks. [link:Learn how to match the incoming error.]',
        {link: <ExternalLink href={OBFUSCATED_ERRORS_DOCS_URL} />}
      )}
    </Alert>
  );
}

// Condition values can get long (full error messages, release ranges), so give the
// modal more room than the 640px default.
const filterModalCss = css`
  max-width: 800px;
  width: 90vw;
`;

const LIST_PATH =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/';
const DETAIL_PATH =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/$filterId/';
const VALIDATE_PATH =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/validate/';

// The filters of a project, as the settings table lists them. The modal
// invalidates this query after a save, so the table picks up the change.
export function customFiltersQueryOptions(organization: Organization, project: Project) {
  return apiOptions.as<CustomInboundFilter[]>()(LIST_PATH, {
    path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
    staleTime: 0,
  });
}

export function getCustomFilterUrl(
  organization: Organization,
  project: Project,
  filterId: string
) {
  return getApiUrl(DETAIL_PATH, {
    path: {
      organizationIdOrSlug: organization.slug,
      projectIdOrSlug: project.slug,
      filterId,
    },
  });
}

// The data types the preview can show. The others have no source yet.
type PreviewDataType = 'error';

// Where the preview reads the stored data of one data type, and what a search can
// check there. Stored data is not what Relay checks, so every count is an estimate.
type PreviewSource = {
  // The count aggregate of the dataset. Metrics count values, so theirs takes one.
  countAxis: string;
  dataset: string;
  // The stored fields that hold what a condition reads at ingestion. A condition
  // matches when any of them does. A condition without fields has no stored copy.
  fields: Partial<Record<ConditionType, string[]>>;
  // The field that names a row in the list of examples, and its column header.
  titleField: string;
  titleLabel: string;
  // Rows belong to an issue, so an example links to its event.
  issueLinks?: boolean;
  // The field search compares as a version. Absent where search cannot.
  versionField?: string;
};

const PREVIEW_SOURCES: Record<PreviewDataType, PreviewSource> = {
  error: {
    dataset: 'errors',
    countAxis: 'count()',
    titleField: 'title',
    titleLabel: t('Title'),
    issueLinks: true,
    versionField: 'release.version',
    fields: {
      error_message: ['error.type', 'error.value'],
      error_type: ['error.type'],
      geo_country_code: ['geo.country_code'],
      release: ['release'],
      ip_address: ['user.ip'],
    },
  },
};

// A filter on every data type previews each data type that has a source.
function getPreviewDataTypes(dataType: FilterDataType): PreviewDataType[] {
  return dataType === 'error' || dataType === 'all' ? ['error'] : [];
}

// The search query that finds the stored data a filter matches, and the one that
// finds the rest, or why search cannot express the filter.
type PreviewQuery =
  | {query: string; unmatchedQuery: string; problem?: undefined}
  | {problem: string; query?: undefined; unmatchedQuery?: undefined};

const INVERSE_COMPARISONS: Partial<Record<ConditionOperator, ConditionOperator>> = {
  gt: 'lte',
  gte: 'lt',
  lt: 'gte',
  lte: 'gt',
};

function negateToken(token: string): string {
  return token.startsWith('!') ? token.slice(1) : `!${token}`;
}

function anyOf(queries: string[]): string {
  return queries.length === 1 ? queries[0]! : `(${queries.join(' OR ')})`;
}

function allOf(queries: string[]): string {
  return queries.length === 1 ? queries[0]! : `(${queries.join(' ')})`;
}

// The search patterns that cover an address or a range of them, since search has
// no range match on an address. Every octet past the prefix becomes one wildcard,
// and an octet the prefix splits lists its values, so a range needs 128 patterns
// at most. Undefined for an IPv6 range: its text form has no fixed prefix.
function ipRangeToPatterns(value: string): string[] | undefined {
  const [address = '', prefixText] = value.split('/');
  if (prefixText === undefined) {
    return [address];
  }
  const octets = address.split('.').map(Number);
  const prefix = Number(prefixText);
  if (octets.length !== 4 || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return undefined;
  }
  const whole = Math.floor(prefix / 8);
  const head = octets.slice(0, whole);
  const tail = whole < 3 ? ['*'] : [];
  if (prefix % 8 === 0) {
    return [whole === 4 ? address : [...head, '*'].join('.')];
  }
  const size = 2 ** (8 - (prefix % 8));
  const first = octets[whole]! - (octets[whole]! % size);
  return Array.from({length: size}, (_, index) =>
    [...head, first + index, ...tail].join('.')
  );
}

function conditionToPreviewQuery(
  condition: CustomInboundFilterCondition,
  source: PreviewSource
): PreviewQuery {
  const fields = source.fields[condition.type];
  if (!fields) {
    return {
      problem: t('A preview cannot check %s.', getCondition(condition.type).label),
    };
  }
  if (condition.type === 'ip_address') {
    const patterns = condition.value.map(ipRangeToPatterns);
    if (patterns.includes(undefined)) {
      return {problem: t('A preview cannot check IPv6 ranges, only single addresses.')};
    }
    condition = {...condition, value: patterns.flatMap(pattern => pattern ?? [])};
  }
  const operator = getConditionOperator(condition);
  const inverse = INVERSE_COMPARISONS[operator];
  if (inverse) {
    if (!source.versionField) {
      return {problem: t('Search cannot compare release versions on this data type.')};
    }
    // Search compares versions on a field that holds no package name.
    const version = escapeTagValue((condition.value[0] ?? '').split('@').pop()!);
    return {
      query: `${source.versionField}:${OPERATOR_PREFIXES[operator]}${version}`,
      unmatchedQuery: `${source.versionField}:${OPERATOR_PREFIXES[inverse]}${version}`,
    };
  }
  // A condition matches when any field does, and a negated one when no field does.
  const tokens = fields.map(field => conditionToToken(condition, field));
  const negatedTokens = tokens.map(negateToken);
  return NEGATED_OPERATORS.has(operator)
    ? {query: tokens.join(' '), unmatchedQuery: anyOf(negatedTokens)}
    : {query: anyOf(tokens), unmatchedQuery: allOf(negatedTokens)};
}

function getPreviewQuery(
  conditions: CustomInboundFilterCondition[],
  source: PreviewSource
): PreviewQuery {
  const queries: string[] = [];
  const unmatchedQueries: string[] = [];
  for (const condition of conditions) {
    const translation = conditionToPreviewQuery(condition, source);
    if (translation.query === undefined) {
      return translation;
    }
    queries.push(translation.query);
    unmatchedQueries.push(translation.unmatchedQuery);
  }
  // A filter matches when every condition does.
  return {query: queries.join(' '), unmatchedQuery: anyOf(unmatchedQueries)};
}

type PreviewExample = {id: string; timestamp: string} & Record<
  string,
  string | number | string[] | null
>;

type PreviewColumn = {fields: string[]; label: string};

// The columns of the list of examples: one per condition, with the stored values
// the condition matched. The title leads unless a condition already shows it.
function getPreviewColumns(
  conditions: CustomInboundFilterCondition[],
  source: PreviewSource
): PreviewColumn[] {
  const columns = Array.from(
    new Set(conditions.map(condition => condition.type)),
    type => ({label: getCondition(type).label, fields: source.fields[type] ?? []})
  );
  return columns.some(column => column.fields.includes(source.titleField))
    ? columns
    : [{label: source.titleLabel, fields: [source.titleField]}, ...columns];
}

function formatPreviewValue(row: PreviewExample, fields: string[]): string {
  return fields.flatMap(field => row[field] ?? []).join(', ') || '\u2014';
}

const PREVIEW_CHART_HEIGHT = 80;
const PREVIEW_EXAMPLE_COUNT = 3;
const EVENTS_STATS_PATH = '/organizations/$organizationIdOrSlug/events-stats/';

function sumCounts(stats: EventsStats | undefined): number {
  return (stats?.data ?? []).reduce(
    (sum, [, counts]) => sum + (counts[0]?.count ?? 0),
    0
  );
}

function PreviewSummary({
  dataType,
  children,
}: {
  children: React.ReactNode;
  dataType: PreviewDataType;
}) {
  return (
    <Flex gap="sm" align="baseline">
      <Text size="sm" bold>
        {DATA_TYPES[dataType].label}
      </Text>
      <Text size="sm" variant="muted">
        {children}
      </Text>
    </Flex>
  );
}

// Shows what `query` matches in the stored data of one data type over the last 24
// hours: how much of it, when it arrived, and the latest few rows on each side.
function SourcePreview({
  project,
  dataType,
  conditions,
  query,
  unmatchedQuery,
}: {
  conditions: CustomInboundFilterCondition[];
  dataType: PreviewDataType;
  project: Project;
  // What search finds for `conditions` in the stored data of `dataType`, and the
  // query for everything else there.
  query: string;
  unmatchedQuery: string;
}) {
  const organization = useOrganization();
  const theme = useTheme();
  const source = PREVIEW_SOURCES[dataType];
  const columns = getPreviewColumns(conditions, source);

  const path = {organizationIdOrSlug: organization.slug};
  const scope = {
    dataset: source.dataset,
    project: project.id,
    statsPeriod: '24h',
    referrer: 'api.settings.inbound-filter-preview',
  };
  const statsOptions = (statsQuery: string) =>
    apiOptions.as<EventsStats>()(EVENTS_STATS_PATH, {
      path,
      query: {
        ...scope,
        query: statsQuery,
        yAxis: source.countAxis,
        interval: '1h',
        partial: 1,
      },
      staleTime: 60_000,
    });
  const totalStats = useQuery(statsOptions(''));
  const matchedStats = useQuery(statsOptions(query));
  const examplesOptions = (examplesQuery: string) =>
    apiOptions.as<{data: PreviewExample[]}>()(
      '/organizations/$organizationIdOrSlug/events/',
      {
        path,
        query: {
          ...scope,
          query: examplesQuery,
          field: [
            'id',
            ...new Set(columns.flatMap(column => column.fields)),
            'timestamp',
            ...(source.issueLinks ? ['issue.id'] : []),
          ],
          sort: '-timestamp',
          per_page: PREVIEW_EXAMPLE_COUNT,
        },
        staleTime: 60_000,
      }
    );
  const matchedExamples = useQuery(examplesOptions(query));
  const unmatchedExamples = useQuery(examplesOptions(unmatchedQuery));

  const queries = [totalStats, matchedStats, matchedExamples, unmatchedExamples];
  const failed = queries.find(result => result.isError);
  if (failed) {
    return (
      <PreviewSummary dataType={dataType}>
        {getErrorDetail(failed.error, t('Unable to load the preview'))}
      </PreviewSummary>
    );
  }
  if (queries.some(result => result.isPending)) {
    return <Placeholder height={`${PREVIEW_CHART_HEIGHT}px`} />;
  }

  const total = sumCounts(totalStats.data);
  if (total === 0) {
    return (
      <PreviewSummary dataType={dataType}>
        {t('None stored in the last 24 hours.')}
      </PreviewSummary>
    );
  }
  const matched = sumCounts(matchedStats.data);
  const matchedByTime = new Map(
    (matchedStats.data?.data ?? []).map(([time, counts]) => [time, counts[0]?.count ?? 0])
  );
  const buckets = (totalStats.data?.data ?? []).map(([time, counts]) => {
    const dropped = matchedByTime.get(time) ?? 0;
    return {
      name: time * 1000,
      dropped,
      kept: Math.max((counts[0]?.count ?? 0) - dropped, 0),
    };
  });

  return (
    <Stack gap="sm">
      <PreviewSummary dataType={dataType}>
        {t(
          '%s of %s match (%s) in the last 24 hours.',
          formatAbbreviatedNumber(matched),
          formatAbbreviatedNumber(total),
          formatPercentage(matched / total, 1)
        )}
      </PreviewSummary>
      <Container
        height={`${PREVIEW_CHART_HEIGHT}px`}
        role="img"
        aria-label={t('Matched and kept data per hour')}
      >
        <MiniBarChart
          stacked
          showXAxisLine
          hideZeros
          isGroupedByDate
          showTimeInTooltip
          height={PREVIEW_CHART_HEIGHT}
          barOpacity={1}
          colors={[
            theme.tokens.graphics.danger.vibrant,
            theme.tokens.graphics.neutral.muted,
          ]}
          tooltip={{appendToBody: true}}
          series={[
            {
              seriesName: t('Would be dropped'),
              data: buckets.map(({name, dropped}) => ({name, value: dropped})),
            },
            {
              seriesName: t('Kept'),
              data: buckets.map(({name, kept}) => ({name, value: kept})),
            },
          ]}
        />
      </Container>
      <Grid
        columns={`max-content repeat(${columns.length}, minmax(0, 1fr)) max-content`}
        gap="xs md"
        align="center"
      >
        <span />
        {columns.map(column => (
          <Text key={column.label} size="xs" variant="muted" bold>
            {column.label}
          </Text>
        ))}
        <Text size="xs" variant="muted" bold>
          {t('Stored')}
        </Text>
        {[
          {
            icon: <IconCheckmark size="xs" variant="success" aria-label={t('Matches')} />,
            rows: matchedExamples.data?.data ?? [],
          },
          {
            icon: (
              <IconClose size="xs" variant="danger" aria-label={t('Does not match')} />
            ),
            rows: unmatchedExamples.data?.data ?? [],
          },
        ].flatMap(({icon, rows}) =>
          rows.map(row => {
            const issueId = row['issue.id'];
            return (
              <Fragment key={row.id}>
                {icon}
                {columns.map((column, index) => {
                  const value = formatPreviewValue(row, column.fields);
                  return (
                    <Text key={column.label} size="sm" ellipsis>
                      {index === 0 && issueId ? (
                        <ExternalLink
                          href={normalizeUrl(
                            `/organizations/${organization.slug}/issues/${issueId}/events/${row.id}/`
                          )}
                        >
                          {value}
                        </ExternalLink>
                      ) : (
                        value
                      )}
                    </Text>
                  );
                })}
                <Text size="sm" variant="muted">
                  <TimeSince date={row.timestamp} />
                </Text>
              </Fragment>
            );
          })
        )}
      </Grid>
    </Stack>
  );
}

// Estimates what the filter would have dropped in the last 24 hours, per data type
// it applies to.
function FilterPreview({
  project,
  dataType,
  conditions,
}: {
  conditions: CustomInboundFilterCondition[];
  dataType: FilterDataType;
  project: Project;
}) {
  const dataTypes = getPreviewDataTypes(dataType);
  if (dataTypes.length === 0) {
    return null;
  }

  return (
    <Stack gap="md">
      <Text bold>{t('Matching Example Issues')}</Text>
      <Stack gap="lg">
        {dataTypes.map(type => {
          const {query, unmatchedQuery, problem} = getPreviewQuery(
            conditions,
            PREVIEW_SOURCES[type]
          );
          return query === undefined ? (
            <PreviewSummary key={type} dataType={type}>
              {problem}
            </PreviewSummary>
          ) : (
            <SourcePreview
              key={type}
              project={project}
              dataType={type}
              conditions={conditions}
              query={query}
              unmatchedQuery={unmatchedQuery}
            />
          );
        })}
      </Stack>
    </Stack>
  );
}

function CustomFilterModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  filter,
}: ModalRenderProps & {
  project: Project;
  // The filter to edit. Absent when the modal creates one.
  filter?: CustomInboundFilter;
}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const hasEnvironmentCondition = organization.features.includes(
    'inbound-filters-environment-condition'
  );

  // A row that holds a legacy list keeps its one condition and its data type: the
  // modal edits the lines of the condition.
  const legacyCondition = filter?.legacyFilter ? filter.conditions[0] : undefined;
  const editor = useMemo(() => getConditionEditor(legacyCondition), [legacyCondition]);
  const filterSchema = useMemo(() => getFilterSchema(editor), [editor]);
  const defaultValues = filter
    ? filterToFormValues(filter, editor)
    : {name: '', dataType: 'error' as const, conditions: ''};
  const modalDataTypeOptions = getModalDataTypeOptions(
    getAvailableDataTypeOptions(organization),
    filter ? defaultValues.dataType : undefined
  );

  const {queryKey} = customFiltersQueryOptions(organization, project);
  const saveMutation = useMutation({
    mutationFn: (values: FilterFormValues) => {
      const data = {
        name: values.name.trim(),
        dataType: values.dataType,
        // The schema already refused a text that does not translate.
        conditions: editor.parse(values.conditions, values.dataType).conditions ?? [],
      };
      return filter
        ? fetchMutation<CustomInboundFilter>({
            method: 'PUT',
            url: getCustomFilterUrl(organization, project, filter.id),
            data,
          })
        : fetchMutation<CustomInboundFilter>({
            method: 'POST',
            url: getApiUrl(LIST_PATH, {
              path: {
                organizationIdOrSlug: organization.slug,
                projectIdOrSlug: project.slug,
              },
            }),
            data,
          });
    },
    onSuccess: () => {
      if (!filter) {
        toast.success(t('Filter created'));
      }
      queryClient.invalidateQueries({queryKey});
    },
    onError: error => {
      toast.error(
        getErrorDetail(
          error,
          filter ? t('Unable to update filter') : t('Unable to create filter')
        )
      );
    },
  });

  const canSuggestName =
    organization.features.includes('inbound-filters-name-suggestion') &&
    !organization.hideAiFeatures;
  const suggestNameMutation = useMutation({
    mutationFn: (draft: CustomInboundFilterDraft) =>
      fetchMutation<CustomInboundFilterValidation>({
        method: 'POST',
        url: getApiUrl(VALIDATE_PATH, {
          path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
        }),
        data: draft,
      }),
  });
  // The last draft asked about and the name its answer filled in. A draft is asked
  // about once, so clearing its suggestion does not bring it back. A suggestion
  // replaces an empty name or the previous suggestion, never a name the user typed.
  const lastSuggestion = useRef({draftKey: '', name: ''});

  const suggestName = (values: FilterFormValues) => {
    const draft = getCompleteDraft(editor, values, filter?.id);
    const draftKey = JSON.stringify(draft);
    const nameIsOpen =
      values.name.trim() === '' || values.name === lastSuggestion.current.name;
    if (
      !canSuggestName ||
      !draft ||
      !nameIsOpen ||
      draftKey === lastSuggestion.current.draftKey
    ) {
      return;
    }
    lastSuggestion.current.draftKey = draftKey;
    // A later request supersedes this one: its callbacks are skipped.
    suggestNameMutation.mutate(draft, {
      onSuccess: ({suggestedName}) => {
        const name = form.getFieldValue('name');
        const stillOpen = name.trim() === '' || name === lastSuggestion.current.name;
        if (!suggestedName || !stillOpen) {
          return;
        }
        lastSuggestion.current.name = suggestedName;
        form.setFieldValue('name', suggestedName);
      },
    });
  };

  // The draft the preview shows. It follows the form when focus leaves a field, so
  // typing sends no queries.
  const [previewed, setPreviewed] = useState<FilterFormValues>(defaultValues);
  const canPreview = organization.features.includes('inbound-filters-preview');
  const previewedConditions = editor.parse(
    previewed.conditions,
    previewed.dataType
  ).conditions;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: filterSchema},
    listeners: {
      onBlur: ({formApi}) => {
        suggestName(formApi.state.values);
        setPreviewed(formApi.state.values);
      },
    },
    onSubmit: ({value}) =>
      saveMutation
        .mutateAsync(value)
        .then(() => closeModal())
        .catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Stack gap="xs">
          <Heading as="h4">
            {filter ? t('Edit Custom Filter') : t('Create Custom Filter')}
          </Heading>
          <Text variant="muted" size="sm">
            {legacyCondition
              ? t(
                  'Sentry drops data whose %s matches any pattern below, one per line. Use * in a pattern as a wildcard.',
                  getCondition(legacyCondition.type).label
                )
              : t(
                  'Sentry drops data that meets every condition below. Type a property, pick an operator, then enter a value. Use * in a value as a wildcard, or list several values to match any of them.'
                )}
          </Text>
        </Stack>
      </Header>
      <Body>
        <Stack gap="xl">
          <Grid columns={{zero: '1fr', md: '3fr minmax(180px, 1fr)'}} gap="md">
            <form.AppField name="name">
              {field => (
                <field.Layout.Stack label={t('Name')} required>
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    placeholder={
                      suggestNameMutation.isPending
                        ? t('Suggesting a name…')
                        : t('e.g. Ignore flaky connection errors')
                    }
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>

            <form.AppField name="dataType">
              {dataTypeField => (
                <dataTypeField.Layout.Stack label={t('Data Type')} required>
                  <dataTypeField.Select
                    clearable={false}
                    disabled={legacyCondition !== undefined}
                    options={modalDataTypeOptions}
                    value={dataTypeField.state.value}
                    onChange={value => dataTypeField.handleChange(value)}
                  />
                </dataTypeField.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          {legacyCondition ? (
            <form.AppField name="conditions">
              {linesField => (
                <linesField.Layout.Stack
                  label={getCondition(legacyCondition.type).label}
                  required
                >
                  <linesField.TextArea
                    placeholder={getCondition(legacyCondition.type).placeholder}
                    value={linesField.state.value}
                    onChange={linesField.handleChange}
                    monospace
                    autosize
                    rows={3}
                    maxRows={15}
                  />
                  {RAW_ERROR_PROPERTIES.has(legacyCondition.type) && (
                    <ObfuscatedErrorWarning project={project} />
                  )}
                </linesField.Layout.Stack>
              )}
            </form.AppField>
          ) : (
            <form.Subscribe selector={state => state.values}>
              {({dataType, conditions}) => (
                <form.AppField name="conditions">
                  {queryField => (
                    <queryField.Layout.Stack
                      label={t('Conditions')}
                      required
                      hintText={
                        dataType === 'all'
                          ? t(
                              'This filter applies to every data type Sentry ingests, including ones added later. Only conditions that every data type carries are available.'
                            )
                          : undefined
                      }
                    >
                      <queryField.Base<HTMLDivElement>>
                        {({disabled, onBlur}) => (
                          <Container flex={1} minWidth={0}>
                            {/* The builder reads its query once, so a data type
                                change remounts it: the query then re-parses against
                                the keys the new data type offers and flags the rest. */}
                            <SearchQueryBuilder
                              key={dataType}
                              label={t('Conditions')}
                              initialQuery={queryField.state.value}
                              filterKeys={getOfferedFilterKeys(
                                dataType,
                                hasEnvironmentCondition
                              )}
                              fieldDefinitionGetter={getFieldDefinitionGetter(dataType)}
                              getTagValues={getNoTagValues}
                              onChange={value => queryField.handleChange(value)}
                              onBlur={onBlur}
                              disabled={disabled}
                              searchSource="custom_inbound_filter"
                              placeholder={t(
                                'e.g. error_message:*timeout* release:<2.0.0'
                              )}
                              invalidMessages={CONDITION_QUERY_MESSAGES}
                              disallowFreeText
                              disallowLogicalOperators
                              disallowUnsupportedFilters
                              keepOperatorOnValueSelect
                              showAllFilterValues
                              showSearchIcon={false}
                              portalTarget={document.body}
                              disableFullWidthFilterKeyMenu
                            />
                          </Container>
                        )}
                      </queryField.Base>
                      {queryField.state.meta.isTouched &&
                        !queryField.state.meta.isValid && (
                          <Text size="sm" variant="danger">
                            {queryField.state.meta.errors
                              .map(error => error?.message)
                              .join(' ')}
                          </Text>
                        )}
                      {(parseConditionQuery(conditions, dataType).conditions ?? []).some(
                        condition => RAW_ERROR_PROPERTIES.has(condition.type)
                      ) && <ObfuscatedErrorWarning project={project} />}
                    </queryField.Layout.Stack>
                  )}
                </form.AppField>
              )}
            </form.Subscribe>
          )}

          {/* A preview answers for the data type it ran on, so a data type change
              hides it until focus leaves the field. */}
          <form.Subscribe selector={state => state.values.dataType}>
            {dataType =>
              canPreview && previewedConditions && previewed.dataType === dataType ? (
                <FilterPreview
                  project={project}
                  dataType={dataType}
                  conditions={previewedConditions}
                />
              ) : null
            }
          </form.Subscribe>
        </Stack>
      </Body>
      <Footer>
        <Flex gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <form.SubmitButton>
            {filter ? t('Save Changes') : t('Create Filter')}
          </form.SubmitButton>
        </Flex>
      </Footer>
    </form.AppForm>
  );
}

// Opens the modal to create a filter, or to edit `filter`. Saving goes through
// the modal, so callers only pick what it opens on.
export function openCustomFilterModal(options: {
  project: Project;
  filter?: CustomInboundFilter;
}) {
  openModal(deps => <CustomFilterModal {...deps} {...options} />, {
    modalCss: filterModalCss,
  });
}
