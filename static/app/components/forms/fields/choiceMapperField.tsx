import {Component, Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';
import type {DistributedOmit} from 'type-fest';

import {Client} from 'sentry/api';
import {Button} from 'sentry/components/core/button';
import {
  CompactSelect,
  type SelectOption,
  type SingleSelectProps,
} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import type {ControlProps} from 'sentry/components/core/select';
import {Select} from 'sentry/components/core/select';
import FormField from 'sentry/components/forms/formField';
import {IconAdd, IconDelete} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {defined} from 'sentry/utils';
import {isEmptyObject} from 'sentry/utils/object/isEmptyObject';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';

interface DefaultProps {
  /**
   * Text used for the 'add row' button.
   */
  addButtonText: NonNullable<React.ReactNode>;
  /**
   * Automatically save even if fields are empty
   */
  allowEmpty: boolean;
  /**
   * If using mappedSelectors to specifically map different choice selectors
   * per item specify this as true.
   */
  perItemMapping: boolean;
}

const defaultProps: DefaultProps = {
  addButtonText: t('Add Item'),
  perItemMapping: false,
  allowEmpty: false,
};

type MappedSelectors = Record<string, Partial<ControlProps>>;

export interface ChoiceMapperProps extends DefaultProps {
  /**
   * Props forwarded to the add mapping dropdown.
   */
  addDropdown: DistributedOmit<SingleSelectProps<string>, 'options' | 'clearable'> & {
    items: Array<SelectOption<string>>;
    noResultsMessage?: string;
    /**
     * Optional URL for async search. When provided, the dropdown will fetch
     * results from this endpoint instead of using the prepopulated items.
     */
    searchField?: string;
    url?: string;
  };
  /**
   * A list of column labels (headers) for the multichoice table. This should
   * have the same mapping keys as the mappedSelectors prop.
   */
  columnLabels: Record<string, React.ReactNode>;
  /**
   * Since we're saving an object, there isn't a great way to render the
   * change within the toast. Just turn off displaying the from/to portion of
   * the message.
   */
  formatMessageValue: boolean;
  /**
   * mappedSelectors controls how the Select control should render for each
   * column. This can be generalised so that each column renders the same set
   * of choices for each mapped item by providing an object with column
   * label keys mapping to the select descriptor, OR you may specify the set
   * of select descriptors *specific* to a mapped item, where the item value
   * maps to the object of column label keys to select descriptor.
   *
   * Example - All selects are the same per column:
   *
   * {
   *   'column_key1: {...select1},
   *   'column_key2: {...select2},
   * }
   *
   * Example - Selects differ for each of the items available:
   *
   * {
   *   'my_object_value':  {'column_key1': {...select1}, 'column_key2': {...select2}},
   *   'other_object_val': {'column_key1': {...select3}, 'column_key2': {...select4}},
   * }
   */
  mappedSelectors: MappedSelectors;
  onChange: InputFieldProps['onChange'];
  // TODO(ts) tighten this up.
  value: Record<string, any>;

  /**
   * Field controls get a boolean.
   */
  disabled?: boolean;

  /**
   * The label to show above the row name selected from the dropdown.
   */
  mappedColumnLabel?: React.ReactNode;

  // TODO(ts) This isn't aligned with InputField but that's what the runtime code had.
  onBlur?: () => void;
}

export interface ChoiceMapperFieldProps
  extends ChoiceMapperProps,
    Omit<
      InputFieldProps,
      'onBlur' | 'onChange' | 'value' | 'formatMessageValue' | 'disabled'
    > {}

type AsyncCompactSelectProps<Value extends string> = Omit<
  SingleSelectProps<Value>,
  'options' | 'searchable' | 'disableSearchFilter' | 'loading' | 'onSearch'
> & {
  /**
   * Function to transform query string into API params
   */
  buildQueryParams: (query: string) => Record<string, unknown>;
  /**
   * Function to transform API response into options
   */
  formatOptions: (data: unknown) => Array<SelectOption<Value>>;
  /**
   * URL to fetch options from
   */
  url: string;
  /**
   * Initial options to show before search
   */
  defaultOptions?: Array<SelectOption<Value>>;
};

/**
 * AsyncCompactSelect combines CompactSelect's button-trigger UI with async search capabilities.
 * It fetches options from an API endpoint as the user types.
 *
 * This component is specific to Integration Configuration page's needs and is not exported for general use.
 */
function AsyncCompactSelectForIntegrationConfig<Value extends string = string>({
  url,
  buildQueryParams,
  formatOptions,
  defaultOptions,
  clearable: _clearable,
  onChange,
  onOpenChange,
  emptyMessage,
  ...compactSelectProps
}: AsyncCompactSelectProps<Value>) {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebouncedValue(query, 250);

  // Use empty baseUrl since /extensions/ endpoints are not under /api/0/
  const [api] = useState(() => new Client({baseUrl: '', headers: {}}));
  useEffect(() => {
    return () => {
      api.clear();
    };
  }, [api]);

  const {data, isFetching} = useQuery({
    queryKey: [url, buildQueryParams(debouncedQuery)],
    queryFn: async () => {
      // This exists because /extensions/type/search API is not prefixed with /api/0/
      // We do this in the externalIssues modal as well unfortunately.
      const response = await api.requestPromise(url, {
        query: buildQueryParams(debouncedQuery),
      });
      return response;
    },
    enabled: !!debouncedQuery,
    staleTime: 30_000,
  });

  const options = data ? formatOptions(data) : defaultOptions || [];

  const handleSearch = (value: string) => {
    setQuery(value);
  };

  const handleChange = (option: SelectOption<Value>) => {
    setQuery('');
    onChange?.(option);
  };

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setQuery('');
    }
    onOpenChange?.(isOpen);
  };

  return (
    <CompactSelect
      {...compactSelectProps}
      searchable
      disableSearchFilter
      clearable={false}
      options={options}
      onSearch={handleSearch}
      onChange={handleChange}
      onOpenChange={handleOpenChange}
      loading={isFetching}
      emptyMessage={isFetching ? t('Loading\u2026') : debouncedQuery ? emptyMessage : ''}
    />
  );
}

export default class ChoiceMapperField extends Component<ChoiceMapperFieldProps> {
  static defaultProps = defaultProps;

  hasValue = (value: InputFieldProps['value']) => defined(value) && !isEmptyObject(value);

  renderField = (props: ChoiceMapperFieldProps) => {
    const {
      onChange,
      onBlur,
      addButtonText,
      addDropdown,
      mappedColumnLabel,
      columnLabels,
      mappedSelectors,
      perItemMapping,
      disabled,
      allowEmpty,
    } = props;

    const mappedKeys = Object.keys(columnLabels);
    const emptyValue = mappedKeys.reduce((a, v) => ({...a, [v]: null}), {});

    const valueIsEmpty = this.hasValue(props.value);
    const value = valueIsEmpty ? props.value : {};

    const saveChanges = (nextValue: ChoiceMapperFieldProps['value']) => {
      onChange?.(nextValue, {});

      const validValues = !Object.values(nextValue)
        .map(o => Object.values(o).find(v => v === null))
        .includes(null);

      if (allowEmpty || validValues) {
        onBlur?.();
      }
    };

    const addRow = (data: SelectOption<string>) => {
      // Include the label in the value for async-loaded items
      const newValue = addDropdown.url
        ? {...emptyValue, __label: data.label}
        : emptyValue;
      saveChanges({...value, [data.value]: newValue});
    };

    const removeRow = (itemKey: string) => {
      saveChanges(
        Object.fromEntries(Object.entries(value).filter(([key, _]) => key !== itemKey))
      );
    };

    const setValue = (
      itemKey: string,
      fieldKey: string,
      fieldValue: string | number | null
    ) => {
      saveChanges({...value, [itemKey]: {...value[itemKey], [fieldKey]: fieldValue}});
    };

    // Remove already added values from the items list
    const selectableValues =
      addDropdown.items?.filter(i => !value.hasOwnProperty(i.value)) ?? [];

    const valueMap =
      addDropdown.items?.reduce<Record<string, React.ReactNode>>((map, item) => {
        map[item.value] = item.label;
        return map;
      }, {}) ?? {};

    const {
      url: asyncUrl,
      searchField,
      items: _items,
      noResultsMessage,
      ...restDropdownProps
    } = addDropdown;

    const buildAsyncQueryParams = (query: string) => ({
      field: searchField,
      query,
    });

    const formatAsyncOptions = (data: any) =>
      data
        .filter((item: SelectOption<string>) => !value.hasOwnProperty(item.value))
        .map((item: SelectOption<string>) => ({
          value: item.value,
          label: item.label,
        }));

    const dropdown = asyncUrl ? (
      <AsyncCompactSelectForIntegrationConfig
        {...restDropdownProps}
        url={asyncUrl}
        value={undefined}
        buildQueryParams={buildAsyncQueryParams}
        formatOptions={formatAsyncOptions}
        defaultOptions={selectableValues}
        onChange={addRow}
        size="xs"
        menuWidth={250}
        disabled={false}
        emptyMessage={noResultsMessage ?? t('No results found')}
        triggerProps={{
          ...restDropdownProps.triggerProps,
          children: (
            <Flex gap="xs">
              <IconAdd /> {addButtonText}
            </Flex>
          ),
        }}
      />
    ) : (
      <CompactSelect
        {...addDropdown}
        value={undefined}
        emptyMessage={
          selectableValues.length === 0
            ? addDropdown.emptyMessage
            : addDropdown.noResultsMessage
        }
        size="xs"
        searchable
        disabled={false}
        options={selectableValues}
        menuWidth={250}
        onChange={addRow}
        triggerProps={{
          ...addDropdown.triggerProps,
          children: (
            <Flex gap="xs">
              <IconAdd /> {addButtonText}
            </Flex>
          ),
        }}
      />
    );

    // The field will be set to inline when there is no value set for the
    // field, just show the dropdown.
    if (!valueIsEmpty) {
      return <div>{dropdown}</div>;
    }

    return (
      <Fragment>
        <Flex align="center">
          <LabelColumn>
            <HeadingItem>{mappedColumnLabel}</HeadingItem>
          </LabelColumn>
          {mappedKeys.map((fieldKey, i) => (
            <Heading key={fieldKey}>
              <HeadingItem>{columnLabels[fieldKey]}</HeadingItem>
              {i === mappedKeys.length - 1 && dropdown}
            </Heading>
          ))}
        </Flex>
        {Object.keys(value).map(itemKey => (
          <Row key={itemKey}>
            <LabelColumn>{value[itemKey].__label ?? valueMap[itemKey]}</LabelColumn>
            {mappedKeys.map((fieldKey, i) => (
              <Column key={fieldKey}>
                <Control>
                  <Select
                    {...(perItemMapping
                      ? mappedSelectors[itemKey]![fieldKey]
                      : mappedSelectors[fieldKey])}
                    height={30}
                    disabled={disabled}
                    onChange={(v: any) => setValue(itemKey, fieldKey, v ? v.value : null)}
                    value={value[itemKey][fieldKey]}
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
              </Column>
            ))}
          </Row>
        ))}
      </Fragment>
    );
  };

  render() {
    return (
      <FormField
        {...this.props}
        inline={({model}: any) => !this.hasValue(model.getValue(this.props.name))}
      >
        {this.renderField}
      </FormField>
    );
  }
}

const Heading = styled('div')`
  display: flex;
  margin-left: ${space(1)};
  flex: 1 0 0;
  align-items: center;
  justify-content: space-between;
`;

const Row = styled('div')`
  display: flex;
  margin-top: ${space(1)};
  align-items: center;
`;

const Column = styled('div')`
  display: flex;
  margin-left: ${space(1)};
  align-items: center;
  flex: 1 0 0;
`;

const Control = styled('div')`
  flex: 1;
`;

const LabelColumn = styled('div')`
  flex: 0 0 200px;
`;

const HeadingItem = styled('div')`
  font-size: 0.8em;
  text-transform: uppercase;
  color: ${p => p.theme.subText};
`;

const Actions = styled('div')`
  margin-left: ${space(1)};
`;
