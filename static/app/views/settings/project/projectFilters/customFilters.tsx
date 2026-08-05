import {useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
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
// the `type` field on the backend serializer exactly.
type ConditionType = 'error_message' | 'metric_name' | 'log_message' | 'release';

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

// A single editable condition row in the modal. The API stores a list of
// values per condition, but the UI edits one glob per row, so each row maps to
// a single-element value list.
type ConditionFormValue = {
  property: ConditionType;
  value: string;
};

type FilterFormValues = {
  conditions: ConditionFormValue[];
  name: string;
};

// Mirrors the custom data filters available on the legacy inbound filters
// page (error messages, metric names, log messages, releases). Conditions
// are glob patterns matched against the selected property.
const ALL_PROPERTY_OPTIONS: PropertyOption[] = [
  {value: 'error_message', label: t('Error Message')},
  {value: 'metric_name', label: t('Metric Name')},
  {value: 'log_message', label: t('Log Message')},
  {value: 'release', label: t('Release')},
];

// Some condition types require the same org ingestion features the legacy data
// filters UI gates them behind. Offering them without the feature lets the user
// build a filter the API rejects on save, so mirror that gating here.
const PROPERTY_FEATURE_FLAGS: Partial<Record<ConditionType, string>> = {
  log_message: 'ourlogs-ingestion',
  metric_name: 'tracemetrics-ingestion',
};

function getAvailablePropertyOptions(organization: Organization): PropertyOption[] {
  return ALL_PROPERTY_OPTIONS.filter(option => {
    const requiredFeature = PROPERTY_FEATURE_FLAGS[option.value];
    return !requiredFeature || organization.features.includes(requiredFeature);
  });
}

// A filter can only target a single data category, so these properties are
// mutually exclusive within one filter — you can't mix error, metric, and log
// conditions. Multiple conditions of the same exclusive property (e.g. two
// error message globs) are still allowed. `release` is not in this set, so it
// can be combined with any other property.
const EXCLUSIVE_PROPERTIES = new Set<ConditionType>([
  'error_message',
  'metric_name',
  'log_message',
]);

function isExclusiveProperty(property: ConditionType) {
  return EXCLUSIVE_PROPERTIES.has(property);
}

function getActiveExclusiveProperty(conditions: ConditionFormValue[]) {
  return conditions.find(condition => isExclusiveProperty(condition.property))?.property;
}

function emptyCondition(property: ConditionType = 'error_message'): ConditionFormValue {
  return {property, value: ''};
}

const filterSchema = z.object({
  name: z.string().trim().min(1, t('Give the filter a name')),
  conditions: z
    .array(
      z.object({
        property: z.enum(['error_message', 'metric_name', 'log_message', 'release']),
        value: z.string().trim().min(1, t('Enter a value to match')),
      })
    )
    .min(1),
});

// Expand the API's per-condition value lists into one editable row per value.
function filterToFormValues(filter: CustomInboundFilter): FilterFormValues {
  const conditions = filter.conditions.flatMap(condition =>
    condition.value.map(value => ({property: condition.type, value}))
  );
  return {
    name: filter.name ?? '',
    conditions: conditions.length > 0 ? conditions : [emptyCondition()],
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

function getPropertyLabel(value: string) {
  return ALL_PROPERTY_OPTIONS.find(option => option.value === value)?.label ?? value;
}

function getValuePlaceholder(property: ConditionType) {
  switch (property) {
    case 'error_message':
      return t('Glob pattern, e.g. *ConnectionError*');
    case 'metric_name':
      return t('Glob pattern, e.g. checkout.*');
    case 'log_message':
      return t('Glob pattern, e.g. *DEBUG*');
    case 'release':
      return t('Glob pattern, e.g. 2.41.*');
    default:
      return t('Glob pattern');
  }
}

// For a given condition, drop any exclusive property already claimed by a
// different condition, so the dropdown only offers valid categories. Two
// conditions sharing the same exclusive property is fine, and `release` is
// never exclusive so it always stays available. The condition's own current
// property is always kept so the select can display the active value.
function getConditionPropertyOptions(
  propertyOptions: PropertyOption[],
  conditions: ConditionFormValue[],
  index: number
) {
  const currentProperty = conditions[index]?.property;
  // An existing filter may reference a property whose ingestion feature is now
  // off, so it's missing from propertyOptions. Keep the stored option available
  // for this row so the select can still display and retain it.
  const availableOptions =
    currentProperty && !propertyOptions.some(option => option.value === currentProperty)
      ? [
          ...propertyOptions,
          ...ALL_PROPERTY_OPTIONS.filter(option => option.value === currentProperty),
        ]
      : propertyOptions;
  return availableOptions.filter(option => {
    if (option.value === currentProperty || !isExclusiveProperty(option.value)) {
      return true;
    }
    const conflicts = conditions.some(
      (other, otherIndex) =>
        otherIndex !== index &&
        isExclusiveProperty(other.property) &&
        other.property !== option.value
    );
    return !conflicts;
  });
}

function ConditionTag({type, value}: {type: ConditionType; value: string}) {
  return (
    <Tag variant="muted">
      <Text monospace size="sm">
        {`${getPropertyLabel(type)}:${value}`}
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
  propertyOptions,
  onSave,
}: ModalRenderProps & {
  onSave: (values: FilterFormValues) => Promise<unknown>;
  propertyOptions: PropertyOption[];
  filter?: CustomInboundFilter;
}) {
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: filter
      ? filterToFormValues(filter)
      : {name: '', conditions: [emptyCondition()]},
    validators: {onDynamic: filterSchema},
    onSubmit: ({value}) =>
      onSave(value)
        .then(() => closeModal())
        .catch(() => {}),
  });

  return (
    <form.AppForm form={form}>
      <Header closeButton>
        <Heading as="h4">
          {filter ? t('Edit Custom Filter') : t('Create Custom Filter')}
        </Heading>
      </Header>
      <Body>
        <Stack gap="xl">
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

          <form.AppField name="conditions">
            {conditionsField => {
              const conditions = conditionsField.state.value;
              const activeExclusiveProperty = getActiveExclusiveProperty(conditions);
              return (
                <Stack gap="sm">
                  <Flex justify="between" align="center" gap="md">
                    <Text variant="muted" size="sm">
                      {t(
                        'Events must match all conditions (combined with AND) to be filtered. Each condition is a glob pattern matched against the selected field.'
                      )}
                    </Text>
                    <Button
                      size="sm"
                      icon={<IconAdd />}
                      onClick={() =>
                        conditionsField.pushValue(emptyCondition(activeExclusiveProperty))
                      }
                    >
                      {t('Add Condition')}
                    </Button>
                  </Flex>
                  {conditions.map((condition, index) => (
                    <Flex key={index} gap="md" align="center">
                      <Container width="160px">
                        <form.AppField name={`conditions[${index}].property`}>
                          {propertyField => (
                            <propertyField.Select
                              aria-label={t('Condition property')}
                              clearable={false}
                              options={getConditionPropertyOptions(
                                propertyOptions,
                                conditions,
                                index
                              )}
                              value={propertyField.state.value}
                              onChange={value => propertyField.handleChange(value)}
                            />
                          )}
                        </form.AppField>
                      </Container>
                      <Text variant="muted">{t('matches')}</Text>
                      <Flex flex={1}>
                        <form.AppField name={`conditions[${index}].value`}>
                          {valueField => (
                            <valueField.Input
                              aria-label={t('Condition value')}
                              placeholder={getValuePlaceholder(condition.property)}
                              value={valueField.state.value}
                              onChange={valueField.handleChange}
                            />
                          )}
                        </form.AppField>
                      </Flex>
                      <Button
                        size="sm"
                        variant="transparent"
                        icon={<IconDelete />}
                        aria-label={t('Remove condition')}
                        disabled={conditions.length === 1}
                        onClick={() => conditionsField.removeValue(index)}
                      />
                    </Flex>
                  ))}
                </Stack>
              );
            }}
          </form.AppField>
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
        getPropertyLabel(condition.type),
        `${getPropertyLabel(condition.type)}:${value}`,
      ])
    ),
  ];
  return haystack.some(field => field.toLowerCase().includes(needle));
}

export function CustomFilters({project}: {project: Project}) {
  const organization = useOrganization();
  const queryClient = useQueryClient();
  const [query, setQuery] = useState('');

  const hasWriteAccess = hasEveryAccess(['project:write'], {organization, project});
  const propertyOptions = getAvailablePropertyOptions(organization);

  const queryOptions = apiOptions.as<CustomInboundFilter[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: 0,
    }
  );
  const {queryKey} = queryOptions;

  const listUrl = getApiUrl(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
    {path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}}
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
        data: {name: values.name.trim(), conditions: formValuesToConditions(values)},
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
      data: {name: values.name.trim(), conditions: formValuesToConditions(values)},
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
            openModal(deps => (
              <CustomFilterModal
                {...deps}
                propertyOptions={propertyOptions}
                onSave={handleCreate}
              />
            ))
          }
        >
          {t('Add Rule')}
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
              <SimpleTable.RowCell>
                <TimeSince date={filter.dateCreated} />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <TimeSince date={filter.dateUpdated} />
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
                      openModal(deps => (
                        <CustomFilterModal
                          {...deps}
                          filter={filter}
                          propertyOptions={propertyOptions}
                          onSave={values => handleEdit(filter.id, values)}
                        />
                      ))
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
  grid-template-columns:
    max-content minmax(0, 1fr) minmax(0, 2fr) max-content max-content
    max-content;
`;
