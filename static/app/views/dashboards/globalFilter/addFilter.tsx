import {useMemo, useState} from 'react';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';

import {Tag as TagBadge} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ValueType} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import {getInitialFilterText} from 'sentry/components/searchQueryBuilder/tokens/utils';
import {IconAdd, IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {
  FieldKind,
  FieldValueType,
  prettifyTagKey,
  type FieldDefinition,
} from 'sentry/utils/fields';
import type {SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {MenuTitleWrapper} from 'sentry/views/dashboards/globalFilter/filterSelector';
import {getFieldDefinitionForDataset} from 'sentry/views/dashboards/globalFilter/utils';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {shouldExcludeTracingKeys} from 'sentry/views/performance/utils';

export const DATASET_CHOICES = new Map<WidgetType, string>([
  [WidgetType.ERRORS, t('Errors')],
  [WidgetType.SPANS, t('Spans')],
  [WidgetType.LOGS, t('Logs')],
  [WidgetType.RELEASE, t('Releases')],
  [WidgetType.ISSUE, t('Issues')],
]);

const UNSUPPORTED_FIELD_KINDS = [FieldKind.FUNCTION];
const UNSUPPORTED_FIELD_VALUE_TYPES = [FieldValueType.DATE];
const IGNORE_DEFAULT_VALUES = [FieldValueType.STRING, FieldValueType.BOOLEAN];

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

  // Maps filter keys to their field definitions
  const fieldDefinitionMap = new Map<string, FieldDefinition | null>();

  // Get filter keys for the selected dataset
  const filterKeyOptions = selectedDataset
    ? Object.entries(filterKeys).flatMap(([_, tag]) => {
        const fieldDefinition = getFieldDefinitionForDataset(tag, selectedDataset);
        const valueType = fieldDefinition?.valueType;
        if (valueType && UNSUPPORTED_FIELD_VALUE_TYPES.includes(valueType)) {
          return [];
        }
        fieldDefinitionMap.set(tag.key, fieldDefinition);

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

            let defaultFilterValue = '';
            const fieldDefinition = fieldDefinitionMap.get(selectedFilterKey.key) ?? null;
            const valueType = fieldDefinition?.valueType;

            if (valueType && !IGNORE_DEFAULT_VALUES.includes(valueType)) {
              defaultFilterValue = getInitialFilterText(
                selectedFilterKey.key,
                fieldDefinition
              );
            }

            const newFilter: GlobalFilter = {
              dataset: selectedDataset,
              tag: pick(selectedFilterKey, 'key', 'name', 'kind'),
              value: defaultFilterValue,
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
        <MenuTitleWrapper>
          {isSelectingFilterKey
            ? t(
                'Select %s Tag',
                selectedDataset ? getDatasetLabel(selectedDataset) : 'Filter'
              )
            : t('Select Filter Dataset')}
        </MenuTitleWrapper>
      }
      menuFooter={isSelectingFilterKey && filterOptionsMenuFooter}
      trigger={triggerProps => (
        <SelectTrigger.IconButton
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
 gap:${p => p.theme.space.xl}

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${p => p.theme.space.md};
  }
`;
