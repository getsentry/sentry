import {useState, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';
import type {DistributedPick} from 'type-fest';

import {Button} from '@sentry/scraps/button';
import {
  CompactSelect,
  type SelectOption,
  type SelectProps,
} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Select} from '@sentry/scraps/select';
import {Text} from '@sentry/scraps/text';

import {Client} from 'sentry/api';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useApi} from 'sentry/utils/useApi';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {JsonFormAdapterFieldConfig} from './types';

type ChoiceMapperConfig = Extract<JsonFormAdapterFieldConfig, {type: 'choice_mapper'}>;

interface ChoiceMapperDropdownProps {
  config: ChoiceMapperConfig;
  onChange: (value: Record<string, Record<string, unknown>>) => void;
  onLabelAdd: (value: string, label: ReactNode) => void;
  value: Record<string, Record<string, unknown>>;
  indicator?: React.ReactNode;
}

interface ChoiceMapperTableProps {
  config: ChoiceMapperConfig;
  labels: Record<string, ReactNode>;
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
  defaultOptions: Array<SelectOption<string>>;
  onChange: (option: SelectOption<string>) => void;
  url: string;
  noResultsMessage?: string;
  searchField?: string;
} & DistributedPick<SelectProps<string>, 'trigger'>) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 200);
  const [apiClient] = useState(() => new Client({baseUrl: ''}));
  const api = useApi({api: apiClient});

  const {data: options = defaultOptions, isFetching} = useQuery({
    queryKey: [url, {field: searchField, query: debouncedSearch}],
    queryFn: (): Promise<Array<SelectOption<string>>> =>
      api.requestPromise(url, {
        query: {field: searchField, query: debouncedSearch},
      }),
    enabled: !!debouncedSearch,
    staleTime: 30_000,
    placeholderData: previousData => (debouncedSearch ? previousData : undefined),
    select: data => data.map(item => ({value: item.value, label: item.label})),
  });

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
  onLabelAdd,
  indicator,
}: ChoiceMapperDropdownProps) {
  const {columnLabels = {}} = config;

  const asyncUrl = config.addDropdown?.url;
  const selectableValues =
    config.addDropdown?.items?.filter(i => !value.hasOwnProperty(i.value)) ?? [];

  const addRow = (item: SelectOption<string>) => {
    const emptyValue = Object.keys(columnLabels).reduce<Record<string, null>>(
      (acc, key) => {
        acc[key] = null;
        return acc;
      },
      {}
    );

    if (asyncUrl) {
      // using item.value as label because it's what we display for saved values too
      onLabelAdd(item.value, item.value);
    }
    onChange({...value, [item.value]: emptyValue});
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
  labels,
  value,
  onUpdate,
  onSave,
  disabled,
}: ChoiceMapperTableProps) {
  const {addDropdown, columnLabels = {}, mappedColumnLabel} = config;

  const mappedKeys = Object.keys(columnLabels);

  const getSelector = (itemKey: string, fieldKey: string) => {
    if (config.perItemMapping) {
      return config.mappedSelectors?.[itemKey]?.[fieldKey];
    }
    return config.mappedSelectors?.[fieldKey];
  };

  const labelMap =
    addDropdown?.items?.reduce(
      (map, item) => {
        map[item.value] = item.label;
        return map;
      },
      {...labels}
    ) ?? {};

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
    <Stack gap="lg">
      <Flex align="center" gap="md">
        <Flex flex="0 0 200px">
          <Text variant="muted" size="xs" uppercase>
            {mappedColumnLabel}
          </Text>
        </Flex>
        {mappedKeys.map(fieldKey => (
          <Flex justify="between" align="center" flex="1 0 0" key={fieldKey}>
            <Text variant="muted" size="xs" uppercase>
              {columnLabels[fieldKey]}
            </Text>
          </Flex>
        ))}
      </Flex>
      {Object.keys(value).map(itemKey => (
        <Flex align="center" gap="md" key={itemKey}>
          <Flex flex="0 0 200px">{labelMap[itemKey]}</Flex>
          {mappedKeys.map((fieldKey, i) => (
            <Flex align="center" flex="1 0 0" gap="md" key={fieldKey}>
              <Flex flex="1" direction="column">
                <Select
                  {...getSelector(itemKey, fieldKey)}
                  options={transformMappedChoices(getSelector(itemKey, fieldKey))}
                  disabled={disabled}
                  onChange={(v: {value: string | number | null} | null) =>
                    setValue(itemKey, fieldKey, v ? v.value : null)
                  }
                  value={value[itemKey]?.[fieldKey] as string | null}
                />
              </Flex>
              {i === mappedKeys.length - 1 && (
                <Button
                  icon={<IconDelete />}
                  size="sm"
                  disabled={disabled}
                  onClick={() => removeRow(itemKey)}
                  aria-label={t('Delete')}
                />
              )}
            </Flex>
          ))}
        </Flex>
      ))}
    </Stack>
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
