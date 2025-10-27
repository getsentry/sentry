import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {Tag as TagBadge} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ValueType} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {
  FieldKind,
  FieldValueType,
  getFieldDefinition,
  prettifyTagKey,
} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {shouldExcludeTracingKeys} from 'sentry/views/performance/utils';

export const DATASET_CHOICES = new Map<WidgetType, string>([
  [WidgetType.ERRORS, t('Errors')],
  [WidgetType.SPANS, t('Spans')],
  [WidgetType.LOGS, t('Logs')],
  [WidgetType.RELEASE, t('Releases')],
  [WidgetType.ISSUE, t('Issues')],
]);

const UNSUPPORTED_FIELD_KINDS = [FieldKind.FUNCTION, FieldKind.MEASUREMENT];
const SUPPORTED_FIELD_VALUE_TYPES = [FieldValueType.STRING, FieldValueType.BOOLEAN];

export function getDatasetLabel(dataset: WidgetType) {
  return DATASET_CHOICES.get(dataset) ?? '';
}

type AddFilterProps = {
  getSearchBarData: (widgetType: WidgetType) => SearchBarData;
  globalFilters: GlobalFilter[];
  onAddFilter: (filter: GlobalFilter) => void;
};

function AddFilter({globalFilters, getSearchBarData, onAddFilter}: AddFilterProps) {
  const [selectedDataset, setSelectedDataset] = useState<WidgetType | null>(null);
  const [selectedFilterKey, setSelectedFilterKey] = useState<Tag | null>(null);
  const [isSelectingFilterKey, setIsSelectingFilterKey] = useState(false);

  // Dataset selection before showing filter keys
  const datasetOptions = useMemo(() => {
    return Array.from(DATASET_CHOICES.entries()).map(([widgetType, label]) => ({
      label,
      value: widgetType,
      trailingItems: <IconArrow direction="right" color="subText" size="xs" />,
    }));
  }, []);

  const filterKeys: Record<string, Tag> = selectedDataset
    ? Object.fromEntries(
        Object.entries(getSearchBarData(selectedDataset).getFilterKeys()).filter(
          ([key, value]) =>
            !shouldExcludeTracingKeys(key) &&
            (!value.kind || !UNSUPPORTED_FIELD_KINDS.includes(value.kind))
        )
      )
    : {};

  // Get filter keys for the selected dataset
  const filterKeyOptions = selectedDataset
    ? Object.entries(filterKeys).flatMap(([_, tag]) => {
        const fieldType = (datasetType: WidgetType) => {
          switch (datasetType) {
            case WidgetType.SPANS:
              return 'span';
            case WidgetType.LOGS:
              return 'log';
            default:
              return 'event';
          }
        };
        const fieldDefinition = getFieldDefinition(
          tag.key,
          fieldType(selectedDataset),
          tag.kind
        );
        const valueType = fieldDefinition?.valueType;

        if (!valueType || !SUPPORTED_FIELD_VALUE_TYPES.includes(valueType)) {
          return [];
        }

        return {
          value: tag.key,
          label: prettifyTagKey(tag.key),
          trailingItems: (
            <TagBadge>
              <ValueType fieldDefinition={fieldDefinition} fieldKind={tag.kind} />
            </TagBadge>
          ),
          disabled: globalFilters.some(
            filter => filter.tag.key === tag.key && filter.dataset === selectedDataset
          ),
        };
      })
    : [];

  // Footer for filter key selection for adding filters and returning to dataset selection
  const filterOptionsMenuFooter = ({
    closeOverlay,
    resetSearch,
  }: {
    closeOverlay: () => void;
    resetSearch: () => void;
  }) => (
    <FooterWrap>
      <Flex gap="md" justify="end">
        <Button
          size="xs"
          borderless
          icon={<IconArrow direction="left" />}
          onClick={() => {
            resetSearch();
            setIsSelectingFilterKey(false);
          }}
        >
          {t('Back')}
        </Button>

        <Button
          size="xs"
          priority="primary"
          disabled={!selectedFilterKey}
          onClick={() => {
            if (!selectedFilterKey || !selectedDataset) return;

            const newFilter: GlobalFilter = {
              dataset: selectedDataset,
              tag: pick(selectedFilterKey, 'key', 'name', 'kind'),
              value: '',
            };
            onAddFilter(newFilter);
            setIsSelectingFilterKey(false);
            closeOverlay();
          }}
        >
          {t('Add Filter')}
        </Button>
      </Flex>
    </FooterWrap>
  );

  return (
    <CompactSelect
      options={isSelectingFilterKey ? filterKeyOptions : datasetOptions}
      searchable={isSelectingFilterKey}
      sizeLimit={50}
      closeOnSelect={false}
      onClose={() => {
        setSelectedFilterKey(null);
        setSelectedDataset(null);
        setIsSelectingFilterKey(false);
      }}
      value={selectedFilterKey?.key ?? ''}
      onChange={(option: SelectOption<string>) => {
        if (isSelectingFilterKey) {
          setSelectedFilterKey(filterKeys[option.value] ?? null);
          return;
        }
        setSelectedDataset(option.value as WidgetType);
        setSelectedFilterKey(null);
        setIsSelectingFilterKey(true);
      }}
      size="md"
      menuWidth="300px"
      menuTitle={
        isSelectingFilterKey ? t('Select Filter Tag') : t('Select Filter Dataset')
      }
      menuFooter={isSelectingFilterKey && filterOptionsMenuFooter}
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          aria-label={t('Add Global Filter')}
          icon={<IconAdd size="sm" />}
        />
      )}
    />
  );
}

export default AddFilter;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${space(1)};
  }
`;
