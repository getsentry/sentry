import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Tag as TagBadge} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Flex} from 'sentry/components/core/layout';
import {ValueType} from 'sentry/components/searchQueryBuilder/tokens/filterKeyListBox/keyDescription';
import {IconArrow, IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag, TagCollection} from 'sentry/types/group';
import {FieldKind, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {WidgetType, type GlobalDashboardFilter} from 'sentry/views/dashboards/types';
import {shouldExcludeTracingKeys} from 'sentry/views/performance/utils';

const DATASET_CHOICES = new Map<WidgetType, string>([
  [WidgetType.ERRORS, t('Errors')],
  [WidgetType.SPANS, t('Spans')],
  [WidgetType.LOGS, t('Logs')],
  [WidgetType.RELEASE, t('Releases')],
  [WidgetType.ISSUE, t('Issues')],
]);

export function getDatasetLabel(dataset: WidgetType) {
  return DATASET_CHOICES.get(dataset);
}

const UNSUPPORTED_FIELD_KINDS = [FieldKind.FUNCTION, FieldKind.MEASUREMENT];

export function getTagType(tag: Tag, dataset: WidgetType | null) {
  const fieldType =
    dataset === WidgetType.SPANS ? 'span' : dataset === WidgetType.LOGS ? 'log' : 'event';
  const fieldDefinition = getFieldDefinition(tag.key, fieldType, tag.kind);

  return <ValueType fieldDefinition={fieldDefinition} fieldKind={tag.kind} />;
}

type AddGlobalFilterProps = {
  onAddFilter: (filter: GlobalDashboardFilter) => void;
};

function AddGlobalFilter({onAddFilter}: AddGlobalFilterProps) {
  const [selectedDataset, setSelectedDataset] = useState<WidgetType | null>(null);
  const [selectedFilterKey, setSelectedFilterKey] = useState<Tag | null>(null);
  const [isSelectingFilterKey, setIsSelectingFilterKey] = useState(false);
  const {selection} = usePageFilters();

  // Dataset selection before showing filter keys
  const datasetOptions = useMemo(() => {
    return Array.from(DATASET_CHOICES.entries()).map(([widgetType, label]) => ({
      label,
      value: widgetType,
      trailingItems: <IconArrow direction="right" color="subText" size="xs" />,
    }));
  }, []);

  const datasetFilterKeysMap = new Map<WidgetType, TagCollection>();

  DATASET_CHOICES.forEach((_, widgetType) => {
    const datasetConfig = getDatasetConfig(widgetType);
    if (datasetConfig.useSearchBarDataProvider) {
      const dataProvider = datasetConfig.useSearchBarDataProvider({
        pageFilters: selection,
      });
      const filterKeys = Object.fromEntries(
        Object.entries(dataProvider.getFilterKeys()).filter(
          ([key, value]) =>
            !shouldExcludeTracingKeys(key) &&
            (!value.kind || !UNSUPPORTED_FIELD_KINDS.includes(value.kind))
        )
      );
      datasetFilterKeysMap.set(widgetType, filterKeys);
    }
  });

  // Get filter keys for the selected dataset
  const filterKeys = (selectedDataset && datasetFilterKeysMap.get(selectedDataset)) || {};
  const filterKeyOptions = Object.entries(filterKeys).map(([_, tag]) => {
    return {
      value: tag.key,
      label: prettifyTagKey(tag.key),
      trailingItems: <TagBadge>{getTagType(tag, selectedDataset)}</TagBadge>,
    };
  });

  // Footer for filter key selection for adding filters and returning to dataset selection
  const filterOptionsMenuFooter = ({closeOverlay}: {closeOverlay: () => void}) => (
    <FooterWrap>
      <Flex gap="md" justify="end">
        <Button
          size="xs"
          borderless
          icon={<IconArrow direction="left" />}
          onClick={() => setIsSelectingFilterKey(false)}
        >
          {t('Back')}
        </Button>

        <Button
          size="xs"
          priority="primary"
          disabled={!selectedFilterKey}
          onClick={() => {
            const newFilter: GlobalDashboardFilter = {
              dataset: selectedDataset!,
              tag: selectedFilterKey!,
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
      clearable={false}
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
        isSelectingFilterKey ? t('Select filter tag') : t('Select Filter Dataset')
      }
      menuFooter={isSelectingFilterKey && filterOptionsMenuFooter}
      trigger={triggerProps => (
        <Button
          {...triggerProps}
          aria-label={t('Add Global Filter')}
          icon={<IconFilter color="subText" size="xs" />}
        />
      )}
    />
  );
}

export default AddGlobalFilter;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${space(1)};
  }
`;
