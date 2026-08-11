import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InfoText} from '@sentry/scraps/info';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd, IconDelete, IconEdit, IconSearch} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
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
  | 'metric_name'
  | 'log_message'
  | 'release';

type CustomInboundFilterCondition = {
  type: ConditionType;
  value: string[];
};

// Shape returned by the custom inbound filters API.
type CustomInboundFilter = {
  active: boolean;
  conditions: CustomInboundFilterCondition[];
  dateCreated: string;
  dateUpdated: string;
  id: string;
  name: string | null;
};

type PropertyOption = {label: string; value: ConditionType};

// The data type a filter applies to. The backend rejects a filter that mixes
// data types, so a filter targets exactly one, which determines the condition
// properties available to it. `DATA_TYPES` below describes each one.
type FilterDataType = 'error' | 'metric' | 'log';

type DataTypeOption = {label: string; value: FilterDataType};

// A single editable condition row in the modal. The API stores a list of
// values per condition, but the UI edits one glob per row, so each row maps to
// a single-element value list.
type ConditionFormValue = {
  property: ConditionType;
  value: string;
};

type FilterFormValues = {
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
};

const DATA_TYPES: Record<FilterDataType, DataTypeSpec> = {
  error: {label: t('Errors')},
  metric: {label: t('Metrics'), feature: 'tracemetrics-ingestion'},
  log: {label: t('Logs'), feature: 'ourlogs-ingestion'},
};

type ConditionSpec = {
  // Names the field the condition globs against. `release` sits on a different
  // field per data type, so its description depends on the filter's data type.
  description: string | Record<FilterDataType, string>;
  label: string;
  placeholder: string;
  // The data type whose field this condition reads. Absent for `release`, which
  // every data type carries, so it stays on offer whatever the filter targets.
  dataType?: FilterDataType;
};

// Declaration order is the order of the property dropdown, and the first
// condition of a data type is the one a new row starts with. Keep `release` last.
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
      error: t('Matches the release of the error.'),
      log: t('Matches the release attribute of the log.'),
      metric: t('Matches the release attribute of the metric.'),
    },
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

// A data type offers the conditions that read its own fields, plus `release`.
function getPropertyOptions(dataType: FilterDataType): PropertyOption[] {
  return CONDITION_TYPES.filter(value => {
    const owner = getCondition(value).dataType;
    return owner === undefined || owner === dataType;
  }).map(value => ({value, label: getCondition(value).label}));
}

// The property a new condition row starts with, and the one existing rows
// collapse to when the user changes the data type. Every data type owns at least
// one condition; errors stand in if that ever stops holding.
function getDefaultProperty(dataType: FilterDataType): ConditionType {
  return (
    CONDITION_TYPES.find(value => getCondition(value).dataType === dataType) ??
    'error_message'
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

const filterSchema = z.object({
  name: z.string().trim().min(1, t('Give the filter a name')),
  dataType: z.enum(FILTER_DATA_TYPES),
  conditions: z
    .array(
      z.object({
        property: z.enum(CONDITION_TYPES),
        value: z.string().trim().min(1, t('Enter a value to match')),
      })
    )
    .min(1),
});

// Expand the API's per-condition value lists into one editable row per value.
// The data type is not stored on the filter; every condition property except
// `release` belongs to one data type, so derive it (release-only filters
// default to errors).
function filterToFormValues(filter: CustomInboundFilter): FilterFormValues {
  const conditions = filter.conditions.flatMap(condition =>
    condition.value.map(value => ({property: condition.type, value}))
  );
  const dataType =
    conditions
      .map(condition => getCondition(condition.property).dataType)
      .find(Boolean) ?? 'error';
  return {
    name: filter.name ?? '',
    dataType,
    conditions:
      conditions.length > 0 ? conditions : [emptyCondition(getDefaultProperty(dataType))],
  };
}

// Collapse the editable rows back into the API shape, one single-value
// condition per row.
function formValuesToConditions(
  values: FilterFormValues
): CustomInboundFilterCondition[] {
  return values.conditions.map(condition => ({
    type: condition.property,
    value: [condition.value.trim()],
  }));
}

function getErrorDetail(error: unknown, fallback: string): string {
  if (error instanceof RequestError) {
    const detail = error.responseJSON?.detail;
    if (typeof detail === 'string') {
      return detail;
    }
  }
  return fallback;
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

// Condition values are glob patterns that can get long (full error messages,
// release ranges), so give the modal more room than the 640px default.
const filterModalCss = css`
  max-width: 800px;
  width: 90vw;
`;

function ConditionTag({type, value}: {type: ConditionType; value: string}) {
  return (
    <Tag variant="muted">
      <Text monospace size="sm">
        {`${getCondition(type).label}:${value}`}
      </Text>
    </Tag>
  );
}

function CustomFilterModal({
  Header,
  Body,
  Footer,
  closeModal,
  filter,
  dataTypeOptions,
  onSave,
}: ModalRenderProps & {
  dataTypeOptions: DataTypeOption[];
  onSave: (values: FilterFormValues) => Promise<unknown>;
  filter?: CustomInboundFilter;
}) {
  const defaultValues = filter
    ? filterToFormValues(filter)
    : {
        name: '',
        dataType: 'error' as const,
        conditions: [emptyCondition('error_message')],
      };
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
              'Sentry only filters data that matches every condition below. Each value is a glob pattern, so * matches any text.'
            )}
          </Text>
        </Stack>
      </Header>
      <Body>
        <Stack gap="xl">
          <Grid columns="4fr 1fr" gap="md">
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
                      // whose property the new data type does not read falls
                      // back to the default one; release rows stay as they are.
                      form.setFieldValue('conditions', conditions =>
                        conditions.map(condition =>
                          condition.property === 'release'
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
                      <Stack gap="sm">
                        {conditions.map((condition, index) => (
                          <Grid
                            key={index}
                            columns="160px max-content 1fr max-content"
                            gap="md"
                            align="center"
                          >
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
                            <InfoText
                              variant="muted"
                              title={getMatchDescription(condition.property, dataType)}
                            >
                              {t('matches')}
                            </InfoText>
                            <form.AppField name={`conditions[${index}].value`}>
                              {valueField => (
                                <valueField.Input
                                  aria-label={t('Condition value')}
                                  placeholder={
                                    getCondition(condition.property).placeholder
                                  }
                                  value={valueField.state.value}
                                  onChange={valueField.handleChange}
                                />
                              )}
                            </form.AppField>
                            <Button
                              size="sm"
                              variant="transparent"
                              icon={<IconDelete />}
                              aria-label={t('Remove condition')}
                              disabled={conditions.length === 1}
                              onClick={() => conditionsField.removeValue(index)}
                            />
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

function matchesQuery(filter: CustomInboundFilter, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  const haystack = [
    filter.name ?? '',
    ...filter.conditions.flatMap(condition =>
      condition.value.flatMap(value => [
        value,
        getCondition(condition.type).label,
        `${getCondition(condition.type).label}:${value}`,
      ])
    ),
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

  const invalidate = () => queryClient.invalidateQueries({queryKey});

  const createMutation = useMutation({
    mutationFn: (values: FilterFormValues) =>
      fetchMutation<CustomInboundFilter>({
        method: 'POST',
        url: listUrl,
        data: {
          name: values.name.trim(),
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
      data: Partial<Pick<CustomInboundFilter, 'name' | 'active' | 'conditions'>>;
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
        conditions: formValuesToConditions(values),
      },
    });

  const handleToggleActive = (filter: CustomInboundFilter) =>
    updateMutation.mutate({id: filter.id, data: {active: !filter.active}});

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const visibleFilters = filters.filter(filter => matchesQuery(filter, query));

  return (
    <Stack gap="lg">
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
        <CustomFiltersTable>
          <SimpleTable.Header>
            <SimpleTable.HeaderCell divider={false}>{t('Active')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell divider={false}>{t('Name')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell divider={false}>
              {t('Conditions')}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell divider={false}>
              {t('Created')}
            </SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell divider={false}>{t('Edited')}</SimpleTable.HeaderCell>
            <SimpleTable.HeaderCell divider={false}>{t('Action')}</SimpleTable.HeaderCell>
          </SimpleTable.Header>
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
                  aria-label={filter.active ? t('Disable filter') : t('Enable filter')}
                  checked={filter.active}
                  disabled={!hasWriteAccess}
                  onChange={() => handleToggleActive(filter)}
                />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Text ellipsis>{filter.name}</Text>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Stack align="start" gap="xs">
                  {filter.conditions.flatMap((condition, conditionIndex) =>
                    condition.value.map((value, valueIndex) => (
                      <ConditionTag
                        key={`${conditionIndex}-${valueIndex}`}
                        type={condition.type}
                        value={value}
                      />
                    ))
                  )}
                </Stack>
              </SimpleTable.RowCell>
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
        </CustomFiltersTable>
      )}
    </Stack>
  );
}

const CustomFiltersTable = styled(SimpleTable)`
  grid-template-columns: 90px minmax(160px, 1fr) minmax(240px, 2fr) 100px 100px 110px;
  overflow-x: auto;
`;
