import {Fragment, useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import startCase from 'lodash/startCase';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InfoText} from '@sentry/scraps/info';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {markLine as createMarkLine} from 'sentry/components/charts/components/markLine';
import {MiniBarChart} from 'sentry/components/charts/miniBarChart';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Placeholder} from 'sentry/components/placeholder';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import {
  escapeTagValue,
  formatFilterValue,
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
  WildcardOperators,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {android, gaming, sourceMaps} from 'sentry/data/platformCategories';
import {IconAdd, IconDelete, IconEdit, IconSearch} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {DataCategoryExact} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {Project} from 'sentry/types/project';
import type {ApiResponse} from 'sentry/utils/api/apiFetch';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {FieldKind, FieldValueType} from 'sentry/utils/fields';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {UsageSeries} from 'sentry/views/organizationStats/types';

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
  | 'ip_address';

// How a condition compares its values to the field. `matches` keeps data that
// matches any value, `does_not_match` keeps data that matches none. The ordered
// operators compare a single value as a version and only apply to `release`.
type ConditionOperator = 'matches' | 'does_not_match' | 'gt' | 'gte' | 'lt' | 'lte';

type CustomInboundFilterCondition = {
  type: ConditionType;
  value: string[];
  // Absent on filters stored before the operator existed. Those match.
  operator?: ConditionOperator;
};

// Shape returned by the custom inbound filters API.
type CustomInboundFilter = {
  active: boolean;
  conditions: CustomInboundFilterCondition[];
  dateCreated: string;
  dateUpdated: string;
  id: string;
  name: string | null;
  // Absent until the API stores the data type on the filter.
  dataType?: FilterDataType;
};

type PropertyOption = {label: string; value: ConditionType};

// The data a filter matches against. It decides which condition properties the
// filter can use. `all` is the catch-all: it matches every data type, so it takes only
// the properties every data type carries a field for.
type FilterDataType = 'all' | 'error' | 'metric' | 'log' | 'span';

type DataTypeOption = {label: string; value: FilterDataType};

// The modal edits the conditions as one search query, one filter token per
// condition. See `parseConditionQuery` for the translation.
type FilterFormValues = {
  dataType: FilterDataType;
  name: string;
  query: string;
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
  // Names the field the condition globs against. `release` sits on a different
  // field per data type, so its description depends on the filter's data type.
  description: string | Record<FilterDataType, string>;
  label: string;
  placeholder: string;
  // Values compare as versions too, so the query builder offers >, >=, < and <=.
  comparable?: boolean;
  // The data type whose field this condition reads. Absent for `release` and
  // `ip_address`, which every data type carries, so they stay on offer whatever
  // the filter targets.
  dataType?: FilterDataType;
  // Values are literal, not glob patterns, so the query builder offers no
  // "contains", "starts with" or "ends with".
  exact?: boolean;
};

// Declaration order is the order of the property dropdown, and the first
// condition of a data type is the one a new row starts with. Keep the conditions
// every data type carries last, `release` first among them: it is the default
// for the catch-all.
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
  ip_address: {
    exact: true,
    label: t('IP Address'),
    placeholder: t('IP address or CIDR range, e.g. 203.0.113.7 or 10.0.0.0/8'),
    description: t(
      'Matches the IP address the data was sent from. Takes single addresses and CIDR ranges, not glob patterns.'
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
// its row in the modal and gets a generic description, instead of breaking it.
const CONDITION_SPECS = new Map<string, ConditionSpec>(Object.entries(CONDITIONS));

function getCondition(property: string): ConditionSpec {
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

const FIELD_DEFINITION_GETTERS = new Map<FilterDataType, FieldDefinitionGetter>();

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
        allowWildcard: !spec.exact,
        disallowWildcardOperators: spec.exact,
      };
    };
    FIELD_DEFINITION_GETTERS.set(dataType, getter);
  }
  return getter;
}

const COMPARISON_OPERATORS: Partial<Record<TermOperator, ConditionOperator>> = {
  [TermOperator.GREATER_THAN]: 'gt',
  [TermOperator.GREATER_THAN_EQUAL]: 'gte',
  [TermOperator.LESS_THAN]: 'lt',
  [TermOperator.LESS_THAN_EQUAL]: 'lte',
};

const COMPARISON_PREFIXES: Partial<Record<ConditionOperator, TermOperator>> = {
  gt: TermOperator.GREATER_THAN,
  gte: TermOperator.GREATER_THAN_EQUAL,
  lt: TermOperator.LESS_THAN,
  lte: TermOperator.LESS_THAN_EQUAL,
};

// The "contains", "starts with" and "ends with" operators of the query builder are
// glob shapes. Each pairs its wildcard marker with the pattern that marker stands for.
const WILDCARD_SHAPES = [
  {wildcard: WildcardOperators.CONTAINS, pattern: /^\*([^*]+)\*$/},
  {wildcard: WildcardOperators.STARTS_WITH, pattern: /^([^*]+)\*$/},
  {wildcard: WildcardOperators.ENDS_WITH, pattern: /^\*([^*]+)$/},
];

function toGlob(operator: TermOperator, value: string): string {
  switch (operator) {
    case TermOperator.CONTAINS:
      return `*${value}*`;
    case TermOperator.STARTS_WITH:
      return `${value}*`;
    case TermOperator.ENDS_WITH:
      return `*${value}`;
    default:
      return value;
  }
}

function tokenToCondition(
  token: TokenResult<Token.FILTER>
): CustomInboundFilterCondition | null {
  const type = getKeyName(token.key);
  if (!CONDITION_SPECS.has(type)) {
    return null;
  }
  const values =
    token.value.type === Token.VALUE_TEXT_LIST
      ? token.value.items.flatMap(item =>
          item.value ? [formatFilterValue({token: item.value})] : []
        )
      : [formatFilterValue({token: token.value})];

  const comparison = COMPARISON_OPERATORS[token.operator];
  if (comparison) {
    if (token.negated || values.length !== 1) {
      return null;
    }
    return {type: type as ConditionType, operator: comparison, value: values};
  }
  return {
    type: type as ConditionType,
    operator: token.negated ? 'does_not_match' : 'matches',
    value: values.map(value => toGlob(token.operator, value)),
  };
}

// Translates the modal's search query into API conditions, one per filter token.
// Tokens AND together, as conditions do. Returns null when the query has no
// condition or one the API would reject: free text, OR, parens, an unknown key, or
// a comparison that is negated or lists several values.
function parseConditionQuery(
  query: string,
  dataType: FilterDataType
): CustomInboundFilterCondition[] | null {
  const parsed = parseQueryBuilderValue(query, getFieldDefinitionGetter(dataType), {
    filterKeys: getFilterKeys(dataType),
    disallowFreeText: true,
    disallowLogicalOperators: true,
    disallowUnsupportedFilters: true,
  });
  if (!queryIsValid(parsed)) {
    return null;
  }
  const conditions: CustomInboundFilterCondition[] = [];
  for (const token of parsed ?? []) {
    if (token.type !== Token.FILTER) {
      continue;
    }
    const condition = tokenToCondition(token);
    if (!condition) {
      return null;
    }
    conditions.push(condition);
  }
  return conditions.length > 0 ? conditions : null;
}

// Globs of one shape, like `*a*` and `*b*`, become the matching wildcard operator
// with the stars removed, so the builder shows "contains a". Mixed shapes stay
// literal globs under "is".
function splitWildcard(globs: string[]): {
  values: string[];
  wildcard: string;
} {
  for (const {wildcard, pattern} of WILDCARD_SHAPES) {
    const values = globs.map(glob => glob.match(pattern)?.[1]);
    if (values.every(value => value !== undefined)) {
      return {wildcard, values};
    }
  }
  return {wildcard: '', values: globs};
}

function conditionToToken(condition: CustomInboundFilterCondition): string {
  const operator = condition.operator ?? 'matches';
  const prefix = COMPARISON_PREFIXES[operator];
  if (prefix) {
    return `${condition.type}:${prefix}${escapeTagValue(condition.value[0] ?? '')}`;
  }
  const negation = operator === 'does_not_match' ? '!' : '';
  const {wildcard, values} = splitWildcard(condition.value);
  const text =
    values.length === 1
      ? escapeTagValue(values[0]!)
      : `[${values.map(escapeTagValue).join(',')}]`;
  return `${negation}${condition.type}:${wildcard}${text}`;
}

function conditionsToQuery(conditions: CustomInboundFilterCondition[]): string {
  return conditions.map(conditionToToken).join(' ');
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

// How the table names an operator. `matches` stays implicit, as before.
const OPERATOR_LABELS: Record<ConditionOperator, string> = {
  matches: '',
  does_not_match: t('does not match'),
  gt: '>',
  gte: '>=',
  lt: '<',
  lte: '<=',
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

const filterSchema = z
  .object({
    name: z.string().trim().min(1, t('Give the filter a name')),
    dataType: z.enum(FILTER_DATA_TYPES),
    query: z.string(),
  })
  .superRefine((values, ctx) => {
    if (!parseConditionQuery(values.query, values.dataType)) {
      ctx.addIssue({
        code: 'custom',
        path: ['query'],
        message: t('Add at least one condition. Every condition must be valid.'),
      });
    }
  });

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

function getDataTypeLabel(filter: CustomInboundFilter): string {
  const dataType = getFilterDataType(filter);
  const spec = DATA_TYPES[dataType];
  return spec?.tableLabel ?? spec?.label ?? dataType;
}

function filterToFormValues(filter: CustomInboundFilter): FilterFormValues {
  return {
    name: filter.name ?? '',
    dataType: getFilterDataType(filter),
    query: conditionsToQuery(filter.conditions),
  };
}

// The schema already refused a query that does not translate, so this never sees one.
function formValuesToConditions(
  values: FilterFormValues
): CustomInboundFilterCondition[] {
  return parseConditionQuery(values.query, values.dataType) ?? [];
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

function getErrorDetail(error: unknown, fallback: string): string {
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

// Condition values are glob patterns that can get long (full error messages,
// release ranges), so give the modal more room than the 640px default.
const filterModalCss = css`
  max-width: 800px;
  width: 90vw;
`;

// Values a condition shows in the table before the rest fold into a count.
const MAX_VISIBLE_VALUES = 3;

function ValueTag({value}: {value: string}) {
  return (
    <Tag variant="muted">
      <Text monospace size="sm">
        {value}
      </Text>
    </Tag>
  );
}

// One condition of a filter: its property, its operator unless it is the plain
// match, then its values. A match reads "a or b"; a negated one reads "a and b",
// as the search bar does, since the data must match none of them.
function ConditionSummary({condition}: {condition: CustomInboundFilterCondition}) {
  const visible = condition.value.slice(0, MAX_VISIBLE_VALUES);
  const hidden = condition.value.slice(MAX_VISIBLE_VALUES);
  const operator = condition.operator ?? 'matches';
  const joiner = operator === 'does_not_match' ? t('and') : t('or');

  return (
    <Flex wrap="wrap" gap="xs" align="center">
      <Text size="sm" variant="muted">
        {getCondition(condition.type).label}
      </Text>
      {OPERATOR_LABELS[operator] && (
        <Text size="sm" variant="muted">
          {OPERATOR_LABELS[operator]}
        </Text>
      )}
      {visible.map((value, index) => (
        <Fragment key={index}>
          {index > 0 && (
            <Text size="xs" variant="muted">
              {joiner}
            </Text>
          )}
          <ValueTag value={value} />
        </Fragment>
      ))}
      {hidden.length > 0 && (
        <Fragment>
          <Text size="xs" variant="muted">
            {joiner}
          </Text>
          <Tag variant="muted">
            <InfoText
              size="sm"
              title={
                <Stack align="start" gap="xs">
                  {hidden.map((value, index) => (
                    <Text key={index} monospace size="sm">
                      {value}
                    </Text>
                  ))}
                </Stack>
              }
            >
              {tn('%s more', '%s more', hidden.length)}
            </InfoText>
          </Tag>
        </Fragment>
      )}
    </Flex>
  );
}

function CustomFilterModal({
  Header,
  Body,
  Footer,
  closeModal,
  project,
  filter,
  dataTypeOptions,
  onSave,
}: ModalRenderProps & {
  dataTypeOptions: DataTypeOption[];
  onSave: (values: FilterFormValues) => Promise<unknown>;
  project: Project;
  filter?: CustomInboundFilter;
}) {
  const defaultValues = filter
    ? filterToFormValues(filter)
    : {name: '', dataType: 'error' as const, query: ''};
  const modalDataTypeOptions = getModalDataTypeOptions(
    dataTypeOptions,
    filter ? defaultValues.dataType : undefined
  );

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: filterSchema},
    onSubmit: ({value}) =>
      onSave(value)
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
            {t(
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
                    placeholder={t('e.g. Ignore flaky connection errors')}
                  />
                </field.Layout.Stack>
              )}
            </form.AppField>

            <form.AppField name="dataType">
              {dataTypeField => (
                <dataTypeField.Layout.Stack label={t('Data Type')} required>
                  <dataTypeField.Select
                    clearable={false}
                    options={modalDataTypeOptions}
                    value={dataTypeField.state.value}
                    onChange={value => dataTypeField.handleChange(value)}
                  />
                </dataTypeField.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          <form.Subscribe selector={state => state.values}>
            {({dataType, query}) => (
              <form.AppField name="query">
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
                    {/* The builder reads its query once, so a data type change
                        remounts it: the query then re-parses against the keys the
                        new data type offers and flags the rest. */}
                    <SearchQueryBuilder
                      key={dataType}
                      label={t('Conditions')}
                      initialQuery={queryField.state.value}
                      filterKeys={getFilterKeys(dataType)}
                      fieldDefinitionGetter={getFieldDefinitionGetter(dataType)}
                      getTagValues={getNoTagValues}
                      onChange={value => queryField.handleChange(value)}
                      searchSource="custom_inbound_filter"
                      placeholder={t('e.g. error_message:*timeout* !release:1.0')}
                      invalidMessages={CONDITION_QUERY_MESSAGES}
                      disallowFreeText
                      disallowLogicalOperators
                      disallowUnsupportedFilters
                      showSearchIcon={false}
                      portalTarget={document.body}
                      disableFullWidthFilterKeyMenu
                    />
                    {queryField.state.meta.isTouched &&
                      !queryField.state.meta.isValid && (
                        <Text size="sm" variant="danger">
                          {queryField.state.meta.errors
                            .map(error => error?.message)
                            .join(' ')}
                        </Text>
                      )}
                    {(parseConditionQuery(query, dataType) ?? []).some(condition =>
                      RAW_ERROR_PROPERTIES.has(condition.type)
                    ) && <ObfuscatedErrorWarning project={project} />}
                  </queryField.Layout.Stack>
                )}
              </form.AppField>
            )}
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

// Window of the per-row sparkline, matching the chart above the table.
const STATS_PERIOD = '30d';
const STATS_INTERVAL = '1d';
const STATS_FIELD = 'sum(quantity)';

// The trend chart keeps this box whatever a row dropped, so that every row in the
// table lines up. The number beside it centers on the same box.
const CHART_HEIGHT = 36;
const CHART_WIDTH = 160;

// Headroom above the tallest bar of a row, which leaves room for the mark line and
// its label. The chart scales to the row it draws, so the same ratio on every row
// puts every tallest bar at one height. The default axis instead rounds a maximum
// below ten up to ten, which makes a row that dropped five look shorter than a row
// that dropped five hundred.
const CHART_HEADROOM = 1.3;

// Plot area inside the chart box. `containLabel` would size it around the labels of
// the row it draws, which puts the bars of one row at a different height from the
// next. Fixed insets hold the baseline at one height, level with the number beside
// it, and keep the right edge clear for the mark line label.
const CHART_GRID = {
  top: 6,
  bottom: 6,
  left: 0,
  right: 25,
  containLabel: false,
};

// The categories a custom filter drops data in. `error` covers default and security
// events too, which the stats endpoint folds into it. Transactions, replays, and
// profile chunks are here because Relay reads an error's release field on those as
// well, so a release condition drops them alongside errors. Byte categories, such as
// `log_byte`, report the same data a second time in bytes, so counting them would
// multiply what a filter dropped.
const STATS_CATEGORIES = [
  'error',
  'transaction',
  'replay',
  'profile_chunk',
  'span',
  'log_item',
  'trace_metric',
];

// A custom filter reports under this reason in ingest outcomes, followed by its id.
// The backend builds the same string when it sends the filter to Relay.
const OUTCOMES_REASON_PREFIX = 'custom-inbound-filter:';

// What one filter dropped, per data category. A filter drops errors, logs, or trace
// metrics, and each of those counts under its own category in ingest outcomes.
type SeriesByCategory = Map<string, number[]>;

type FilteredStats = {
  intervals: string[];
  seriesByReason: Map<string, SeriesByCategory>;
};

// One request covers the whole table, so index the outcomes by the reason a row
// reports under before the table reads them.
function selectFilteredStats({json}: ApiResponse<UsageSeries>): FilteredStats {
  const seriesByReason = new Map<string, SeriesByCategory>();

  for (const group of json.groups) {
    const reason = String(group.by.reason ?? '');
    const category = String(group.by.category ?? '');
    const byCategory = seriesByReason.get(reason) ?? new Map<string, number[]>();

    byCategory.set(category, group.series[STATS_FIELD] ?? []);
    seriesByReason.set(reason, byCategory);
  }

  return {intervals: json.intervals, seriesByReason};
}

function getCategoryName(category: string): string {
  const info = DATA_CATEGORY_INFO[category as DataCategoryExact];
  return startCase(info?.displayName ?? category);
}

// The categories a filter dropped data in, largest first, so that the tallest one
// sits at the bottom of the stack.
function getCategorySeries(seriesByCategory: SeriesByCategory | undefined) {
  return Array.from(seriesByCategory ?? [], ([category, values]) => ({
    category,
    values,
    total: values.reduce((sum, value) => sum + value, 0),
  }))
    .filter(({total}) => total > 0)
    .sort((a, b) => b.total - a.total);
}

// Renders the trend and the total, one table cell each.
function FilteredVolumeCells({
  intervals,
  seriesByCategory,
  isPending,
  isError,
}: {
  intervals: string[];
  isError: boolean;
  isPending: boolean;
  seriesByCategory: SeriesByCategory | undefined;
}) {
  const theme = useTheme();

  if (isPending) {
    return (
      <Fragment>
        <SimpleTable.RowCell>
          <Placeholder height={`${CHART_HEIGHT}px`} width={`${CHART_WIDTH}px`} />
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Placeholder height="16px" width="40px" />
          </Flex>
        </SimpleTable.RowCell>
      </Fragment>
    );
  }

  if (isError) {
    return (
      <Fragment>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Text variant="muted">{'—'}</Text>
          </Flex>
        </SimpleTable.RowCell>
        <SimpleTable.RowCell>
          <Flex height={`${CHART_HEIGHT}px`} align="center">
            <Text variant="muted">{'—'}</Text>
          </Flex>
        </SimpleTable.RowCell>
      </Fragment>
    );
  }

  const categories = getCategorySeries(seriesByCategory);
  const total = categories.reduce(
    (sum, {total: categoryTotal}) => sum + categoryTotal,
    0
  );

  // The mark line sits at the tallest stack, which is higher than any one category.
  // A filter that dropped nothing keeps the empty chart, and shows no mark line.
  const peak = Math.max(
    0,
    ...intervals.map((_, index) =>
      categories.reduce((sum, {values}) => sum + (values[index] ?? 0), 0)
    )
  );

  const markLine = createMarkLine({
    silent: true,
    animation: false,
    lineStyle: {
      color: theme.tokens.border.transparent.neutral.moderate,
      type: [4, 3], // Sets line type to "dashed" with 4 length and 3 gap
      opacity: 0.6,
      cap: 'round', // Rounded edges for the dashes
    },
    data: [{yAxis: peak}],
    label: {
      show: true,
      position: 'end',
      opacity: 1,
      color: theme.tokens.content.secondary,
      fontFamily: 'Rubik',
      fontSize: 10,
      formatter: formatAbbreviatedNumber(peak),
    },
  });

  const colors = theme.chart.getColorPalette(Math.max(categories.length, 1));

  const series = categories.length
    ? categories.map(({category, values}, index) => ({
        seriesName: getCategoryName(category),
        markLine: index === 0 && peak > 0 ? markLine : undefined,
        data: intervals.map((name, i) => ({name, value: values[i] ?? 0})),
      }))
    : [
        {
          seriesName: t('Filtered'),
          data: intervals.map(name => ({name, value: 0})),
        },
      ];

  return (
    <Fragment>
      <SimpleTable.RowCell>
        <Container
          width={`${CHART_WIDTH}px`}
          height={`${CHART_HEIGHT}px`}
          role="img"
          aria-label={t('Filtered volume trend, peak %s', formatAbbreviatedNumber(peak))}
        >
          <MiniBarChart
            stacked
            animateBars
            showXAxisLine
            showMarkLineLabel
            hideZeros
            isGroupedByDate
            showTimeInTooltip
            height={CHART_HEIGHT}
            barOpacity={1}
            hideDelay={50}
            markLineLabelSide="right"
            grid={CHART_GRID}
            colors={colors}
            tooltip={{appendToBody: true}}
            yAxisMax={peak > 0 ? peak * CHART_HEADROOM : undefined}
            series={series}
          />
        </Container>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Flex height={`${CHART_HEIGHT}px`} align="center">
          <Text tabular variant={total === 0 ? 'muted' : 'primary'}>
            {formatAbbreviatedNumber(total)}
          </Text>
        </Flex>
      </SimpleTable.RowCell>
    </Fragment>
  );
}

function matchesQuery(filter: CustomInboundFilter, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  const haystack = [
    filter.name ?? '',
    getDataTypeLabel(filter),
    ...filter.conditions.flatMap(condition => [
      getCondition(condition.type).label,
      ...condition.value,
    ]),
  ];
  return haystack.some(field => field.toLowerCase().includes(needle));
}

export function CustomFilters({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const hasWriteAccess = hasEveryAccess(['project:write'], {
    organization,
    project,
  });
  const dataTypeOptions = getAvailableDataTypeOptions(organization);

  const queryOptions = apiOptions.as<CustomInboundFilter[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
      },
      staleTime: 0,
    }
  );
  const {queryKey} = queryOptions;

  const listUrl = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
    {
      path: {
        organizationIdOrSlug: organization.slug,
        projectIdOrSlug: project.slug,
      },
    }
  );
  const detailUrl = (filterId: string) =>
    getApiUrl(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/$filterId/',
      {
        path: {
          organizationIdOrSlug: organization.slug,
          projectIdOrSlug: project.slug,
          filterId,
        },
      }
    );

  const {data: filters = [], isPending, isError, refetch} = useQuery(queryOptions);

  const {
    data: stats,
    isPending: isStatsPending,
    isError: isStatsError,
  } = useQuery({
    ...apiOptions.as<UsageSeries>()('/organizations/$organizationIdOrSlug/stats_v2/', {
      path: {organizationIdOrSlug: organization.slug},
      query: {
        project: project.id,
        outcome: 'filtered',
        field: STATS_FIELD,
        category: STATS_CATEGORIES,
        groupBy: ['reason', 'category'],
        interval: STATS_INTERVAL,
        statsPeriod: STATS_PERIOD,
      },
      staleTime: Infinity,
    }),
    select: selectFilteredStats,
  });

  const invalidate = () => queryClient.invalidateQueries({queryKey});

  const createMutation = useMutation({
    mutationFn: (values: FilterFormValues) =>
      fetchMutation<CustomInboundFilter>({
        method: 'POST',
        url: listUrl,
        data: {
          name: values.name.trim(),
          dataType: values.dataType,
          conditions: formValuesToConditions(values),
        },
      }),
    onSuccess: () => {
      addSuccessMessage(t('Filter created'));
      invalidate();
    },
    onError: error => {
      addErrorMessage(getErrorDetail(error, t('Unable to create filter')));
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      data: Partial<
        Pick<CustomInboundFilter, 'name' | 'active' | 'dataType' | 'conditions'>
      >;
      id: string;
    }) =>
      fetchMutation<CustomInboundFilter>({
        method: 'PUT',
        url: detailUrl(id),
        data,
      }),
    onSuccess: () => invalidate(),
    onError: error => {
      addErrorMessage(getErrorDetail(error, t('Unable to update filter')));
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      fetchMutation({
        method: 'DELETE',
        url: detailUrl(id),
      }),
    onSuccess: () => {
      addSuccessMessage(t('Filter deleted'));
      invalidate();
    },
    onError: error => {
      addErrorMessage(getErrorDetail(error, t('Unable to delete filter')));
    },
  });

  const handleCreate = (values: FilterFormValues) => createMutation.mutateAsync(values);

  const handleEdit = (id: string, values: FilterFormValues) =>
    updateMutation.mutateAsync({
      id,
      data: {
        name: values.name.trim(),
        dataType: values.dataType,
        conditions: formValuesToConditions(values),
      },
    });

  const handleToggleActive = (filter: CustomInboundFilter) =>
    updateMutation.mutate({id: filter.id, data: {active: !filter.active}});

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const visibleFilters = filters.filter(filter => matchesQuery(filter, query));

  return (
    <Stack gap="lg">
      <Heading as="h2" size="md">
        {t('Filter Rules')}
      </Heading>
      <Flex gap="md" align="center">
        <Flex flex={1}>
          <InputGroup style={{width: '100%'}}>
            <InputGroup.LeadingItems disablePointerEvents>
              <IconSearch size="sm" />
            </InputGroup.LeadingItems>
            <InputGroup.Input
              size="sm"
              aria-label={t('Search rules')}
              placeholder={t('Search rules')}
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
          </InputGroup>
        </Flex>
        <Button
          size="sm"
          variant="primary"
          icon={<IconAdd />}
          disabled={!hasWriteAccess}
          tooltipProps={
            hasWriteAccess
              ? undefined
              : {title: t('You need project write access to add filters.')}
          }
          onClick={() =>
            openModal(
              deps => (
                <CustomFilterModal
                  {...deps}
                  project={project}
                  dataTypeOptions={dataTypeOptions}
                  onSave={handleCreate}
                />
              ),
              {modalCss: filterModalCss}
            )
          }
        >
          {t('Add Filter')}
        </Button>
      </Flex>

      {isError ? (
        <LoadingError onRetry={refetch} />
      ) : isPending ? (
        <LoadingIndicator />
      ) : (
        <Container containerType="inline-size">
          <CustomFiltersTable columns={CUSTOM_FILTER_COLUMNS} customSections scrollable>
            <SimpleTable.Head sticky>
              <SimpleTable.HeaderRow>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Active')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Name')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Data Type')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Conditions')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Trend')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Filtered')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Created')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Edited')}
                </SimpleTable.HeaderCell>
                <SimpleTable.HeaderCell divider={false}>
                  {t('Action')}
                </SimpleTable.HeaderCell>
              </SimpleTable.HeaderRow>
            </SimpleTable.Head>
            <SimpleTable.Body>
              {visibleFilters.length === 0 && (
                <SimpleTable.Empty>
                  {filters.length === 0
                    ? t('No inbound filters found')
                    : t('No rules match your search')}
                </SimpleTable.Empty>
              )}
              {visibleFilters.map(filter => (
                <SimpleTable.Row
                  key={filter.id}
                  variant={filter.active ? 'default' : 'faded'}
                >
                  <SimpleTable.RowCell>
                    <Switch
                      aria-label={
                        filter.active ? t('Disable filter') : t('Enable filter')
                      }
                      checked={filter.active}
                      disabled={!hasWriteAccess}
                      onChange={() => handleToggleActive(filter)}
                    />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <InfoText mode="overflowOnly" title={filter.name}>
                      {filter.name}
                    </InfoText>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Text ellipsis variant="muted">
                      {getDataTypeLabel(filter)}
                    </Text>
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Stack align="start" gap="xs">
                      {filter.conditions.map((condition, index) => (
                        <ConditionSummary key={index} condition={condition} />
                      ))}
                    </Stack>
                  </SimpleTable.RowCell>
                  <FilteredVolumeCells
                    intervals={stats?.intervals ?? []}
                    seriesByCategory={stats?.seriesByReason.get(
                      `${OUTCOMES_REASON_PREFIX}${filter.id}`
                    )}
                    isPending={isStatsPending}
                    isError={isStatsError}
                  />
                  <SimpleTable.RowCell whiteSpace="nowrap">
                    <TimeSince date={filter.dateCreated} unitStyle="extraShort" />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell whiteSpace="nowrap">
                    <TimeSince date={filter.dateUpdated} unitStyle="extraShort" />
                  </SimpleTable.RowCell>
                  <SimpleTable.RowCell>
                    <Flex gap="sm">
                      <Button
                        size="sm"
                        variant="transparent"
                        icon={<IconEdit />}
                        aria-label={t('Edit filter')}
                        disabled={!hasWriteAccess}
                        onClick={() =>
                          openModal(
                            deps => (
                              <CustomFilterModal
                                {...deps}
                                project={project}
                                filter={filter}
                                dataTypeOptions={dataTypeOptions}
                                onSave={values => handleEdit(filter.id, values)}
                              />
                            ),
                            {modalCss: filterModalCss}
                          )
                        }
                      />
                      <Confirm
                        priority="danger"
                        disabled={!hasWriteAccess}
                        message={t('Are you sure you want to delete this filter?')}
                        onConfirm={() => handleDelete(filter.id)}
                      >
                        <Button
                          size="sm"
                          variant="transparent"
                          icon={<IconDelete />}
                          aria-label={t('Delete filter')}
                        />
                      </Confirm>
                    </Flex>
                  </SimpleTable.RowCell>
                </SimpleTable.Row>
              ))}
            </SimpleTable.Body>
          </CustomFiltersTable>
        </Container>
      )}
    </Stack>
  );
}

// A column joins the table only once the conditions still have room to read at that
// width. The dates need the most room, so they go first as the table narrows, then
// the trend, then the total.
const CUSTOM_FILTER_COLUMNS: TableColumnConfig[] = [
  {key: 'active', width: '90px'},
  {key: 'name', width: 'minmax(160px, 1fr)'},
  {key: 'dataType', width: '120px'},
  {key: 'conditions', width: 'minmax(240px, 2fr)'},
  {key: 'trend', visible: {'3xl': true}, width: '190px'},
  {key: 'filtered', visible: {'2xl': true}, width: '90px'},
  {key: 'created', visible: {'5xl': true}, width: '90px'},
  {key: 'edited', visible: {'5xl': true}, width: '90px'},
  {key: 'action', width: '110px'},
];

// A fixed height keeps the search box and the sections below the table in place
// while a search shrinks or grows the list. The grid would otherwise stretch its
// rows to fill the spare height.
const CustomFiltersTable = styled(SimpleTable)`
  height: 480px;
  align-content: start;
`;
