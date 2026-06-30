import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useMutation, useQuery, useQueryClient} from '@tanstack/react-query';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input, InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Confirm} from 'sentry/components/confirm';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd, IconDelete, IconEdit, IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {uniqueId} from 'sentry/utils/guid';
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

// A single editable condition row in the modal. The API stores a list of
// values per condition, but the UI edits one glob per row, so each row maps to
// a single-element value list.
type DraftCondition = {
  id: string;
  property: ConditionType;
  value: string;
};

type FilterDraft = {
  conditions: DraftCondition[];
  name: string;
};

// Mirrors the custom data filters available on the legacy inbound filters
// page (error messages, metric names, log messages, releases). Conditions
// are glob patterns matched against the selected property.
const PROPERTY_OPTIONS: Array<{label: string; value: ConditionType}> = [
  {value: 'error_message', label: t('Error Message')},
  {value: 'metric_name', label: t('Metric Name')},
  {value: 'log_message', label: t('Log Message')},
  {value: 'release', label: t('Release')},
];

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

function getActiveExclusiveProperty(conditions: DraftCondition[]) {
  return conditions.find(condition => isExclusiveProperty(condition.property))?.property;
}

function emptyCondition(property: ConditionType = 'error_message'): DraftCondition {
  return {id: uniqueId(), property, value: ''};
}

// Expand the API's per-condition value lists into one editable row per value.
function filterToDraft(filter: CustomInboundFilter): FilterDraft {
  const conditions = filter.conditions.flatMap(condition =>
    condition.value.map(value => ({id: uniqueId(), property: condition.type, value}))
  );
  return {
    name: filter.name ?? '',
    conditions: conditions.length > 0 ? conditions : [emptyCondition()],
  };
}

// Collapse the editable rows back into the API shape, one single-value
// condition per row.
function draftToConditions(draft: FilterDraft): CustomInboundFilterCondition[] {
  return draft.conditions.map(condition => ({
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
  return PROPERTY_OPTIONS.find(option => option.value === value)?.label ?? value;
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
  onSave,
}: ModalRenderProps & {
  onSave: (draft: FilterDraft) => Promise<unknown>;
  filter?: CustomInboundFilter;
}) {
  const [draft, setDraft] = useState<FilterDraft>(() =>
    filter ? filterToDraft(filter) : {name: '', conditions: [emptyCondition()]}
  );
  const [isSaving, setIsSaving] = useState(false);

  const isValid =
    draft.name.trim() !== '' &&
    draft.conditions.length > 0 &&
    draft.conditions.every(condition => condition.value.trim() !== '');

  const updateCondition = (id: string, updates: Partial<DraftCondition>) => {
    setDraft(current => ({
      ...current,
      conditions: current.conditions.map(condition =>
        condition.id === id ? {...condition, ...updates} : condition
      ),
    }));
  };

  // For a given condition, disable any exclusive property already claimed by a
  // different condition. Two conditions sharing the same exclusive property is
  // fine, and `release` is never exclusive so it stays enabled.
  const getPropertyOptions = (condition: DraftCondition) =>
    PROPERTY_OPTIONS.map(option => {
      if (!isExclusiveProperty(option.value)) {
        return option;
      }
      const conflicts = draft.conditions.some(
        other =>
          other.id !== condition.id &&
          isExclusiveProperty(other.property) &&
          other.property !== option.value
      );
      return conflicts
        ? {
            ...option,
            disabled: true,
            trailingItems: (
              <Tooltip
                title={t(
                  'A filter can only target one of error, metric, or log data. Remove the existing condition to switch.'
                )}
              >
                <IconWarning size="sm" variant="warning" />
              </Tooltip>
            ),
          }
        : option;
    });

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(draft);
      closeModal();
    } catch {
      setIsSaving(false);
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h4">
          {filter ? t('Edit Custom Filter') : t('Create Custom Filter')}
        </Heading>
      </Header>
      <Body>
        <Flex direction="column" gap="xl">
          <Flex direction="column" gap="sm">
            <Text bold size="sm">
              {t('Name')}
            </Text>
            <Input
              aria-label={t('Filter name')}
              placeholder={t('e.g. Ignore flaky connection errors')}
              value={draft.name}
              onChange={e => setDraft(current => ({...current, name: e.target.value}))}
            />
          </Flex>

          <Flex direction="column" gap="sm">
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
                  setDraft(current => ({
                    ...current,
                    conditions: [
                      ...current.conditions,
                      emptyCondition(getActiveExclusiveProperty(current.conditions)),
                    ],
                  }))
                }
              >
                {t('Add Condition')}
              </Button>
            </Flex>
            {draft.conditions.map(condition => (
              <Flex key={condition.id} gap="md" align="center">
                <Container width="160px">
                  <Select
                    aria-label={t('Condition property')}
                    name={`condition-property-${condition.id}`}
                    clearable={false}
                    options={getPropertyOptions(condition)}
                    value={condition.property}
                    onChange={(option: {value: ConditionType}) =>
                      updateCondition(condition.id, {property: option.value})
                    }
                  />
                </Container>
                <Text variant="muted">{t('matches')}</Text>
                <Flex flex={1}>
                  <Input
                    aria-label={t('Condition value')}
                    placeholder={getValuePlaceholder(condition.property)}
                    value={condition.value}
                    onChange={e => updateCondition(condition.id, {value: e.target.value})}
                  />
                </Flex>
                <Button
                  size="sm"
                  variant="transparent"
                  icon={<IconDelete />}
                  aria-label={t('Remove condition')}
                  disabled={draft.conditions.length === 1}
                  onClick={() =>
                    setDraft(current => ({
                      ...current,
                      conditions: current.conditions.filter(c => c.id !== condition.id),
                    }))
                  }
                />
              </Flex>
            ))}
          </Flex>
        </Flex>
      </Body>
      <Footer>
        <Flex gap="md">
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            variant="primary"
            disabled={!isValid || isSaving}
            busy={isSaving}
            onClick={handleSave}
          >
            {filter ? t('Save Changes') : t('Create Filter')}
          </Button>
        </Flex>
      </Footer>
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

  const queryOptions = apiOptions.as<CustomInboundFilter[]>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/custom-inbound-filters/',
    {
      path: {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug},
      staleTime: 0,
    }
  );
  const {queryKey} = queryOptions;
  const [listUrl] = queryKey;
  const detailUrl = (id: string) => `${listUrl}${id}/`;

  const {data: filters = [], isPending, isError, refetch} = useQuery(queryOptions);

  const invalidate = () => queryClient.invalidateQueries({queryKey});

  const createMutation = useMutation({
    mutationFn: (draft: FilterDraft) =>
      fetchMutation<CustomInboundFilter>({
        method: 'POST',
        url: listUrl,
        data: {name: draft.name.trim(), conditions: draftToConditions(draft)},
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

  const handleCreate = (draft: FilterDraft) => createMutation.mutateAsync(draft);

  const handleEdit = (id: string, draft: FilterDraft) =>
    updateMutation.mutateAsync({
      id,
      data: {name: draft.name.trim(), conditions: draftToConditions(draft)},
    });

  const handleToggleActive = (filter: CustomInboundFilter) =>
    updateMutation.mutate({id: filter.id, data: {active: !filter.active}});

  const handleDelete = (id: string) => deleteMutation.mutate(id);

  const visibleFilters = filters.filter(filter => matchesQuery(filter, query));

  return (
    <Flex direction="column" gap="lg">
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
          onClick={() =>
            openModal(deps => <CustomFilterModal {...deps} onSave={handleCreate} />)
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
                  onChange={() => handleToggleActive(filter)}
                />
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Tooltip title={filter.name} showOnlyOnOverflow skipWrapper>
                  <Text ellipsis>{filter.name}</Text>
                </Tooltip>
              </SimpleTable.RowCell>
              <SimpleTable.RowCell>
                <Flex direction="column" align="start" gap="xs">
                  {filter.conditions.flatMap((condition, conditionIndex) =>
                    condition.value.map((value, valueIndex) => (
                      <ConditionTag
                        key={`${conditionIndex}-${valueIndex}`}
                        type={condition.type}
                        value={value}
                      />
                    ))
                  )}
                </Flex>
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
                    onClick={() =>
                      openModal(deps => (
                        <CustomFilterModal
                          {...deps}
                          filter={filter}
                          onSave={draft => handleEdit(filter.id, draft)}
                        />
                      ))
                    }
                  />
                  <Confirm
                    priority="danger"
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
    </Flex>
  );
}

const CustomFiltersTable = styled(SimpleTable)`
  grid-template-columns:
    max-content minmax(0, 1fr) minmax(0, 2fr) max-content max-content
    max-content;
`;
