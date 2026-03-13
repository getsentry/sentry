import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import type {DistributedPick} from 'type-fest';

import {Button} from '@sentry/scraps/button';
import {
  CompactSelect,
  type SelectOption,
  type SelectProps,
} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Select} from '@sentry/scraps/select';

import {Client} from 'sentry/api';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {JsonFormAdapterFieldConfig} from './types';

type ChoiceMapperConfig = Extract<JsonFormAdapterFieldConfig, {type: 'choice_mapper'}>;

interface ChoiceMapperDropdownProps {
  config: ChoiceMapperConfig;
  onChange: (value: Record<string, Record<string, unknown>>) => void;
  value: Record<string, Record<string, unknown>>;
  indicator?: React.ReactNode;
}

interface ChoiceMapperTableProps {
  config: ChoiceMapperConfig;
  onSave: (value: Record<string, Record<string, unknown>>) => void;
  onUpdate: (value: Record<string, Record<string, unknown>>) => void;
  value: Record<string, Record<string, unknown>>;
  disabled?: boolean;
}

/**
 * Async search dropdown that fetches options from a URL as the user types.
 */
function AsyncSearchCompactSelect({
  url,
  searchField,
  defaultOptions,
  noResultsMessage,
  onChange,
  ...triggerProps
}: {
  onChange: (option: SelectOption<string>) => void;
  url: string;
  defaultOptions?: Array<SelectOption<string>>;
  noResultsMessage?: string;
  searchField?: string;
} & DistributedPick<SelectProps<string>, 'trigger'>) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [apiClient] = useState(() => new Client({baseUrl: ''}));
  const api = useApi({api: apiClient});

  const {data, isFetching} = useQuery<Array<SelectOption<string>>>({
    queryKey: [url, {field: searchField, query: debouncedSearch}],
    queryFn: () =>
      api.requestPromise(url, {
        query: {field: searchField, query: debouncedSearch},
      }),
    enabled: !!debouncedSearch,
    staleTime: 30_000,
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
  });

  const options =
    data?.map(item => ({value: item.value, label: item.label})) ?? defaultOptions ?? [];

  return (
    <CompactSelect
      {...triggerProps}
      value={undefined}
      search={{filter: false, onChange: setSearch}}
      clearable={false}
      disabled={false}
      options={options}
      onChange={option => {
        setSearch('');
        onChange(option);
      }}
      onOpenChange={(isOpen: boolean) => {
        if (!isOpen) {
          setSearch('');
        }
      }}
      loading={isFetching}
      emptyMessage={
        isFetching
          ? t('Searching\u2026')
          : debouncedSearch
            ? (noResultsMessage ?? t('No results found'))
            : t('Type to search')
      }
      size="xs"
      menuWidth={250}
    />
  );
}

/**
 * Renders just the "Add" dropdown button.
 * Placed inside Layout.Row alongside the label.
 */
export function ChoiceMapperDropdown({
  config,
  value,
  onChange,
  indicator,
}: ChoiceMapperDropdownProps) {
  const {columnLabels = {}} = config;
  const mappedKeys = Object.keys(columnLabels);
  const emptyValue = mappedKeys.reduce<Record<string, null>>(
    (a, v) => ({...a, [v]: null}),
    {}
  );

  const asyncUrl = config.addDropdown?.url;
  const selectableValues =
    config.addDropdown?.items?.filter(i => !value.hasOwnProperty(i.value)) ?? [];

  const addRow = (item: SelectOption<string>) => {
    const newValue = asyncUrl ? {...emptyValue, __label: item.label} : emptyValue;
    onChange({...value, [item.value]: newValue});
  };

  if (asyncUrl) {
    return (
      <Flex align="center" gap="sm">
        <AsyncSearchCompactSelect
          url={asyncUrl}
          searchField={config.addDropdown?.searchField}
          defaultOptions={selectableValues.map(i => ({value: i.value, label: i.label}))}
          noResultsMessage={config.addDropdown?.noResultsMessage ?? t('No results found')}
          onChange={addRow}
          trigger={triggerProps => (
            <OverlayTrigger.Button {...triggerProps}>
              <Flex gap="xs">
                <IconAdd /> {config.addButtonText ?? t('Add Item')}
              </Flex>
            </OverlayTrigger.Button>
          )}
        />
        {indicator}
      </Flex>
    );
  }

  return (
    <Flex align="center" gap="sm">
      <CompactSelect
        value={undefined}
        emptyMessage={
          selectableValues.length === 0
            ? config.addDropdown?.emptyMessage
            : config.addDropdown?.noResultsMessage
        }
        size="xs"
        search
        disabled={false}
        options={selectableValues.map(i => ({value: i.value, label: i.label}))}
        menuWidth={250}
        onChange={addRow}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps}>
            <Flex gap="xs">
              <IconAdd /> {config.addButtonText ?? t('Add Item')}
            </Flex>
          </OverlayTrigger.Button>
        )}
      />
      {indicator}
    </Flex>
  );
}

/**
 * Renders the mapping table rows (header + data rows).
 * Placed below the Layout.Row.
 */
export function ChoiceMapperTable({
  config,
  value,
  onUpdate,
  onSave,
  disabled,
}: ChoiceMapperTableProps) {
  const {
    addDropdown,
    columnLabels = {},
    mappedSelectors = {},
    mappedColumnLabel,
    perItemMapping = false,
  } = config;

  const mappedKeys = Object.keys(columnLabels);

  const valueMap =
    addDropdown?.items?.reduce<Record<string, string>>((map, item) => {
      map[item.value] = item.label;
      return map;
    }, {}) ?? {};

  const allColumnsFilled = (val: Record<string, Record<string, unknown>>) =>
    Object.values(val).every(row =>
      mappedKeys.every(key => row[key] !== null && row[key] !== undefined)
    );

  const updateAndSaveIfComplete = (newValue: Record<string, Record<string, unknown>>) => {
    onUpdate(newValue);
    if (allColumnsFilled(newValue)) {
      onSave(newValue);
    }
  };

  const removeRow = (itemKey: string) => {
    const newValue = Object.fromEntries(
      Object.entries(value).filter(([key]) => key !== itemKey)
    );
    updateAndSaveIfComplete(newValue);
  };

  const setValue = (
    itemKey: string,
    fieldKey: string,
    cellValue: string | number | null
  ) => {
    const newValue = {...value, [itemKey]: {...value[itemKey], [fieldKey]: cellValue}};
    updateAndSaveIfComplete(newValue);
  };

  const hasValues = Object.keys(value).length > 0;

  if (!hasValues) {
    return null;
  }

  return (
    <Fragment>
      <Flex align="center" marginTop="lg">
        <LabelColumn>
          <HeadingItem>{mappedColumnLabel}</HeadingItem>
        </LabelColumn>
        {mappedKeys.map(fieldKey => (
          <Flex
            justify="between"
            align="center"
            flex="1 0 0"
            marginLeft="md"
            key={fieldKey}
          >
            <HeadingItem>{columnLabels[fieldKey]}</HeadingItem>
          </Flex>
        ))}
      </Flex>
      {Object.keys(value).map(itemKey => (
        <Flex align="center" marginTop="md" key={itemKey}>
          <LabelColumn>
            {(value[itemKey]?.__label as string) ?? valueMap[itemKey]}
          </LabelColumn>
          {mappedKeys.map((fieldKey, i) => (
            <Flex align="center" flex="1 0 0" marginLeft="md" key={fieldKey}>
              <Control>
                <Select
                  {...(perItemMapping
                    ? mappedSelectors[itemKey]?.[fieldKey]
                    : mappedSelectors[fieldKey])}
                  options={transformMappedChoices(
                    perItemMapping
                      ? (mappedSelectors as any)[itemKey]?.[fieldKey]
                      : mappedSelectors[fieldKey]
                  )}
                  height={30}
                  disabled={disabled}
                  onChange={(v: {value: string | number | null} | null) =>
                    setValue(itemKey, fieldKey, v ? v.value : null)
                  }
                  value={value[itemKey]?.[fieldKey] as string | null}
                />
              </Control>
              {i === mappedKeys.length - 1 && (
                <Actions>
                  <Button
                    icon={<IconDelete />}
                    size="sm"
                    disabled={disabled}
                    onClick={() => removeRow(itemKey)}
                    aria-label={t('Delete')}
                  />
                </Actions>
              )}
            </Flex>
          ))}
        </Flex>
      ))}
    </Fragment>
  );
}

/**
 * Transform choice tuples from the backend config into Select options.
 */
function transformMappedChoices(
  selector?: {choices?: Array<[string, string]>; placeholder?: string} | unknown
): Array<{label: string; value: string}> {
  if (!selector || typeof selector !== 'object') {
    return [];
  }
  const choices = (selector as {choices?: Array<[string, string]>}).choices;
  if (!Array.isArray(choices)) {
    return [];
  }
  return choices.map(([val, label]) => ({value: val, label}));
}

const Control = styled('div')`
  flex: 1;
`;

const LabelColumn = styled('div')`
  flex: 0 0 200px;
`;

const HeadingItem = styled('div')`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.secondary};
`;

const Actions = styled('div')`
  margin-left: ${p => p.theme.space.md};
`;
