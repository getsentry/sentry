import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Input, InputGroup} from '@sentry/scraps/input';
import {Container, Flex} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';
import {Switch} from '@sentry/scraps/switch';
import {Heading, Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {Confirm} from 'sentry/components/confirm';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {TimeSince} from 'sentry/components/timeSince';
import {IconAdd, IconDelete, IconEdit, IconSearch, IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {uniqueId} from 'sentry/utils/guid';

type CustomFilterCondition = {
  id: string;
  property: string;
  value: string;
};

type CustomFilter = {
  conditions: CustomFilterCondition[];
  dateCreated: string;
  dateEdited: string;
  id: string;
  isActive: boolean;
  name: string;
};

type FilterDraft = {
  conditions: CustomFilterCondition[];
  name: string;
};

// Mirrors the custom data filters available on the legacy inbound filters
// page (error messages, metric names, log messages, releases). Conditions
// are glob patterns matched against the selected property.
const PROPERTY_OPTIONS = [
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
const EXCLUSIVE_PROPERTIES = new Set(['error_message', 'metric_name', 'log_message']);

function isExclusiveProperty(property: string) {
  return EXCLUSIVE_PROPERTIES.has(property);
}

function getActiveExclusiveProperty(conditions: CustomFilterCondition[]) {
  return conditions.find(condition => isExclusiveProperty(condition.property))?.property;
}

// Placeholder data so the table can be exercised locally. This will be
// replaced by data from the API once the backend exists.
const INITIAL_FILTERS: CustomFilter[] = [
  {
    id: uniqueId(),
    name: 'Ignore flaky connection errors',
    isActive: true,
    conditions: [
      {id: uniqueId(), property: 'error_message', value: '*ConnectionError*'},
      {id: uniqueId(), property: 'release', value: '2.41.*'},
    ],
    dateCreated: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000).toISOString(),
    dateEdited: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uniqueId(),
    name: 'Drop debug log spam',
    isActive: false,
    conditions: [{id: uniqueId(), property: 'log_message', value: '*DEBUG*'}],
    dateCreated: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    dateEdited: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: uniqueId(),
    name: 'Filter internal test metrics',
    isActive: true,
    conditions: [{id: uniqueId(), property: 'metric_name', value: 'test.*'}],
    dateCreated: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    dateEdited: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
  },
];

function emptyCondition(property = 'error_message'): CustomFilterCondition {
  return {id: uniqueId(), property, value: ''};
}

function getPropertyLabel(value: string) {
  return PROPERTY_OPTIONS.find(option => option.value === value)?.label ?? value;
}

function getValuePlaceholder(property: string) {
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

function ConditionTag({condition}: {condition: CustomFilterCondition}) {
  return (
    <Tag variant="muted">
      <Text monospace size="sm">
        {`${getPropertyLabel(condition.property)}:${condition.value}`}
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
  onSave: (draft: FilterDraft) => void;
  filter?: CustomFilter;
}) {
  const [draft, setDraft] = useState(
    filter
      ? {name: filter.name, conditions: filter.conditions}
      : {name: '', conditions: [emptyCondition()]}
  );

  const isValid =
    draft.name.trim() !== '' &&
    draft.conditions.length > 0 &&
    draft.conditions.every(condition => condition.value.trim() !== '');

  const updateCondition = (id: string, updates: Partial<CustomFilterCondition>) => {
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
  const getPropertyOptions = (condition: CustomFilterCondition) =>
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
                    onChange={(option: {value: string}) =>
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
            disabled={!isValid}
            onClick={() => {
              onSave(draft);
              closeModal();
            }}
          >
            {filter ? t('Save Changes') : t('Create Filter')}
          </Button>
        </Flex>
      </Footer>
    </Fragment>
  );
}

function matchesQuery(filter: CustomFilter, query: string) {
  const needle = query.trim().toLowerCase();
  if (needle === '') {
    return true;
  }
  const haystack = [
    filter.name,
    ...filter.conditions.flatMap(condition => [
      condition.value,
      getPropertyLabel(condition.property),
      `${getPropertyLabel(condition.property)}:${condition.value}`,
    ]),
  ];
  return haystack.some(field => field.toLowerCase().includes(needle));
}

export function CustomFilters() {
  const [filters, setFilters] = useState(INITIAL_FILTERS);
  const [query, setQuery] = useState('');

  const visibleFilters = filters.filter(filter => matchesQuery(filter, query));

  const handleToggleActive = (id: string) => {
    setFilters(current =>
      current.map(filter =>
        filter.id === id ? {...filter, isActive: !filter.isActive} : filter
      )
    );
  };

  const handleDelete = (id: string) => {
    setFilters(current => current.filter(filter => filter.id !== id));
  };

  const handleCreate = (draft: FilterDraft) => {
    const now = new Date().toISOString();
    setFilters(current => [
      ...current,
      {
        id: uniqueId(),
        name: draft.name.trim(),
        isActive: true,
        conditions: draft.conditions,
        dateCreated: now,
        dateEdited: now,
      },
    ]);
  };

  const handleUpdate = (id: string, draft: FilterDraft) => {
    const now = new Date().toISOString();
    setFilters(current =>
      current.map(filter =>
        filter.id === id
          ? {
              ...filter,
              name: draft.name.trim(),
              conditions: draft.conditions,
              dateEdited: now,
            }
          : filter
      )
    );
  };

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

      <CustomFiltersTable>
        <SimpleTable.Header>
          <SimpleTable.HeaderCell divider={false}>{t('Active')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell divider={false}>{t('Name')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell divider={false}>
            {t('Conditions')}
          </SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell divider={false}>{t('Created')}</SimpleTable.HeaderCell>
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
            variant={filter.isActive ? 'default' : 'faded'}
          >
            <SimpleTable.RowCell>
              <Switch
                aria-label={filter.isActive ? t('Disable filter') : t('Enable filter')}
                checked={filter.isActive}
                onChange={() => handleToggleActive(filter.id)}
              />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Tooltip title={filter.name} showOnlyOnOverflow skipWrapper>
                <Text ellipsis>{filter.name}</Text>
              </Tooltip>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Flex direction="column" align="start" gap="xs">
                {filter.conditions.map(condition => (
                  <ConditionTag key={condition.id} condition={condition} />
                ))}
              </Flex>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TimeSince date={filter.dateCreated} />
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <TimeSince date={filter.dateEdited} />
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
                        onSave={draft => handleUpdate(filter.id, draft)}
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
    </Flex>
  );
}

const CustomFiltersTable = styled(SimpleTable)`
  grid-template-columns:
    max-content minmax(0, 1fr) minmax(0, 2fr) max-content max-content
    max-content;
`;
