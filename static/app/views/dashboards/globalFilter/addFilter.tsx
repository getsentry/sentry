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
import {FieldKind, getFieldDefinition, prettifyTagKey} from 'sentry/utils/fields';
import type {DatasetSearchBarData} from 'sentry/views/dashboards/hooks/useSearchBarData';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {shouldExcludeTracingKeys} from 'sentry/views/performance/utils';

type SupportedDataset =
  | WidgetType.ERRORS
  | WidgetType.SPANS
  | WidgetType.LOGS
  | WidgetType.RELEASE
  | WidgetType.ISSUE;

export const DATASET_CHOICES = new Map<SupportedDataset, string>([
  [WidgetType.ERRORS, t('Errors')],
  [WidgetType.SPANS, t('Spans')],
  [WidgetType.LOGS, t('Logs')],
  [WidgetType.RELEASE, t('Releases')],
  [WidgetType.ISSUE, t('Issues')],
]);

const UNSUPPORTED_FIELD_KINDS = [FieldKind.FUNCTION, FieldKind.MEASUREMENT];

export function getDatasetLabel(dataset: SupportedDataset) {
  return DATASET_CHOICES.get(dataset);
}

function getTagType(tag: Tag, dataset: SupportedDataset | null) {
  const fieldType =
    dataset === WidgetType.SPANS ? 'span' : dataset === WidgetType.LOGS ? 'log' : 'event';
  const fieldDefinition = getFieldDefinition(tag.key, fieldType, tag.kind);

  return <ValueType fieldDefinition={fieldDefinition} fieldKind={tag.kind} />;
}

type AddFilterProps = {
  datasetSearchBarData: DatasetSearchBarData;
  onAddFilter: (filter: GlobalFilter) => void;
};

function AddFilter({datasetSearchBarData, onAddFilter}: AddFilterProps) {
  const [selectedDataset, setSelectedDataset] = useState<SupportedDataset | null>(null);
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
        Object.entries(datasetSearchBarData[selectedDataset].getFilterKeys()).filter(
          ([key, value]) =>
            !shouldExcludeTracingKeys(key) &&
            (!value.kind || !UNSUPPORTED_FIELD_KINDS.includes(value.kind))
        )
      )
    : {};

  // Get filter keys for the selected dataset
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
      clearable={false}
      value={selectedFilterKey?.key ?? ''}
      onChange={(option: SelectOption<string>) => {
        if (isSelectingFilterKey) {
          setSelectedFilterKey(filterKeys[option.value] ?? null);
          return;
        }
        setSelectedDataset(option.value as SupportedDataset);
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
