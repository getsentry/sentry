import {css, useTheme} from '@emotion/react';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {android, gaming, sourceMaps} from 'sentry/data/platformCategories';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {PlatformKey} from 'sentry/types/platform';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
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
  | 'ip_address';

export type CustomInboundFilterCondition = {
  type: ConditionType;
  value: string[];
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
};

type PropertyOption = {label: string; value: ConditionType};

// The data a filter matches against. It decides which condition properties the
// filter can use. `all` is the catch-all: it matches every data type, so it takes only
// the properties every data type carries a field for.
type FilterDataType = 'all' | 'error' | 'metric' | 'log' | 'span';

type DataTypeOption = {label: string; value: FilterDataType};

// A single editable condition row in the modal. The API stores a list of
// values per condition; the row edits them as one text with a value per line.
type ConditionFormValue = {
  property: ConditionType;
  value: string;
};

export type FilterFormValues = {
  conditions: ConditionFormValue[];
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
  // Names the field the condition globs against. `release` sits on a different
  // field per data type, so its description depends on the filter's data type.
  description: string | Record<FilterDataType, string>;
  label: string;
  placeholder: string;
  // The data type whose field this condition reads. Absent for `release` and
  // `ip_address`, which every data type carries, so they stay on offer whatever
  // the filter targets.
  dataType?: FilterDataType;
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

// The property a new condition row starts with, and the one existing rows
// collapse to when the user changes the data type. The catch-all owns no condition
// of its own, so it falls back to the first one every data type carries.
function getDefaultProperty(dataType: FilterDataType): ConditionType {
  return (
    CONDITION_TYPES.find(value => getCondition(value).dataType === dataType) ??
    CONDITION_TYPES.find(value => getCondition(value).dataType === undefined) ??
    'release'
  );
}

function dataTypeOption(value: FilterDataType): DataTypeOption {
  return {value, label: DATA_TYPES[value].label};
}

function getAvailableDataTypeOptions(organization: Organization): DataTypeOption[] {
  return FILTER_DATA_TYPES.filter(value => {
    const feature = DATA_TYPES[value].feature;
    return !feature || organization.features.includes(feature);
  }).map(dataTypeOption);
}

function emptyCondition(property: ConditionType): ConditionFormValue {
  return {property, value: ''};
}

// The values of a condition row, one per non-empty line of its text.
function splitConditionValues(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
}

const filterSchema = z.object({
  name: z.string().trim().min(1, t('Give the filter a name')),
  dataType: z.enum(FILTER_DATA_TYPES),
  conditions: z
    .array(
      z.object({
        property: z.enum(CONDITION_TYPES),
        value: z
          .string()
          .refine(
            text => splitConditionValues(text).length > 0,
            t('Enter a value to match')
          ),
      })
    )
    .min(1),
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

export function getDataTypeLabel(filter: CustomInboundFilter): string {
  const dataType = getFilterDataType(filter);
  const spec = DATA_TYPES[dataType];
  return spec?.tableLabel ?? spec?.label ?? dataType;
}

// One editable row per condition, with its values one per line.
function filterToFormValues(filter: CustomInboundFilter): FilterFormValues {
  const conditions = filter.conditions.map(condition => ({
    property: condition.type,
    value: condition.value.join('\n'),
  }));
  const dataType = getFilterDataType(filter);
  return {
    name: filter.name ?? '',
    dataType,
    conditions:
      conditions.length > 0 ? conditions : [emptyCondition(getDefaultProperty(dataType))],
  };
}

// Collapse the editable rows back into the API shape, one condition per row.
function formValuesToConditions(
  values: FilterFormValues
): CustomInboundFilterCondition[] {
  return values.conditions.map(condition => ({
    type: condition.property,
    value: splitConditionValues(condition.value),
  }));
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

// Condition values are glob patterns that can get long (full error messages,
// release ranges), so give the modal more room than the 640px default.
const filterModalCss = css`
  max-width: 800px;
  width: 90vw;
`;

const LIST_PATH =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/';
const DETAIL_PATH =
  '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/$filterId/';

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
  const theme = useTheme();

  const defaultValues = filter
    ? filterToFormValues(filter)
    : {
        name: '',
        dataType: 'error' as const,
        conditions: [emptyCondition('error_message')],
      };
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
        conditions: formValuesToConditions(values),
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
        addSuccessMessage(t('Filter created'));
      }
      queryClient.invalidateQueries({queryKey});
    },
    onError: error => {
      addErrorMessage(
        getErrorDetail(
          error,
          filter ? t('Unable to update filter') : t('Unable to create filter')
        )
      );
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues,
    validators: {onDynamic: filterSchema},
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
            {t(
              'Sentry only filters data that matches every condition below. Each value is a glob pattern, so * matches any text. Put one pattern per line to match any of them.'
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
                    onChange={value => {
                      dataTypeField.handleChange(value);
                      // Carry existing rows over to the new data type. A row
                      // whose property the new data type does not offer falls
                      // back to the default one; the rest stay as they are.
                      const offered = new Set(
                        getPropertyOptions(value).map(option => option.value)
                      );
                      form.setFieldValue('conditions', conditions =>
                        conditions.map(condition =>
                          offered.has(condition.property)
                            ? condition
                            : {
                                ...condition,
                                property: getDefaultProperty(value),
                              }
                        )
                      );
                    }}
                  />
                </dataTypeField.Layout.Stack>
              )}
            </form.AppField>
          </Grid>

          <form.Subscribe selector={state => state.values.dataType}>
            {dataType => (
              <form.AppField name="conditions">
                {conditionsField => {
                  const conditions = conditionsField.state.value;
                  return (
                    <Stack gap="lg">
                      {dataType === 'all' && (
                        <Text variant="muted" size="sm">
                          {t(
                            'This filter applies to every data type Sentry ingests, including ones added later. Only conditions that every data type carries are available.'
                          )}
                        </Text>
                      )}
                      {/* The value textarea grows with its lines, so the row aligns
                          to the top and the single-line cells center on the control
                          height to line up with the first line. On a narrow screen
                          the row folds into property, "matches", and value lines. */}
                      <Stack gap="sm">
                        {conditions.map((condition, index) => (
                          <Grid
                            key={index}
                            areas={{
                              zero: '"property remove" "matches matches" "value value"',
                              md: '"property matches value remove"',
                            }}
                            columns={{
                              zero: '1fr max-content',
                              md: '160px max-content 1fr max-content',
                            }}
                            gap={{zero: 'xs md', md: 'md'}}
                            align="start"
                          >
                            <Container area="property">
                              <form.AppField name={`conditions[${index}].property`}>
                                {propertyField => (
                                  <propertyField.Select
                                    aria-label={t('Condition property')}
                                    clearable={false}
                                    options={getPropertyOptions(dataType)}
                                    value={propertyField.state.value}
                                    onChange={value => propertyField.handleChange(value)}
                                  />
                                )}
                              </form.AppField>
                            </Container>
                            <Flex
                              area="matches"
                              align="center"
                              height={{zero: 'auto', md: theme.form.md.height}}
                            >
                              <InfoText
                                variant="muted"
                                title={getMatchDescription(condition.property, dataType)}
                              >
                                {t('matches')}
                              </InfoText>
                            </Flex>
                            <Container area="value">
                              <form.AppField name={`conditions[${index}].value`}>
                                {valueField => (
                                  <valueField.TextArea
                                    aria-label={t('Condition value')}
                                    placeholder={
                                      getCondition(condition.property).placeholder
                                    }
                                    value={valueField.state.value}
                                    onChange={valueField.handleChange}
                                    monospace
                                    autosize
                                    rows={1}
                                    maxRows={10}
                                  />
                                )}
                              </form.AppField>
                            </Container>
                            <Flex
                              area="remove"
                              align="center"
                              height={theme.form.md.height}
                            >
                              <Button
                                size="sm"
                                variant="transparent"
                                icon={<IconDelete />}
                                aria-label={t('Remove condition')}
                                disabled={conditions.length === 1}
                                onClick={() => conditionsField.removeValue(index)}
                              />
                            </Flex>
                          </Grid>
                        ))}
                      </Stack>
                      <Flex>
                        <Button
                          size="sm"
                          icon={<IconAdd />}
                          onClick={() =>
                            conditionsField.pushValue(
                              emptyCondition(getDefaultProperty(dataType))
                            )
                          }
                        >
                          {t('Add Condition')}
                        </Button>
                      </Flex>
                      {conditions.some(condition =>
                        RAW_ERROR_PROPERTIES.has(condition.property)
                      ) && <ObfuscatedErrorWarning project={project} />}
                    </Stack>
                  );
                }}
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
