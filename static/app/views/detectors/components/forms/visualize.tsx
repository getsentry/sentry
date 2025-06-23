import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import SelectField from 'sentry/components/forms/fields/selectField';
import {SearchQueryBuilder} from 'sentry/components/searchQueryBuilder';
import type {FilterKeySection} from 'sentry/components/searchQueryBuilder/types';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {TagCollection} from 'sentry/types/group';
import {
  ALLOWED_EXPLORE_VISUALIZE_AGGREGATES,
  FieldKey,
  FieldKind,
  MobileVital,
  prettifyTagKey,
  WebVital,
} from 'sentry/utils/fields';
import useOrganization from 'sentry/utils/useOrganization';
import useTags from 'sentry/utils/useTags';
import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {
  DetectorDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';

function getDatasetConfig(dataset: DetectorDataset) {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return ErrorsConfig;
    case DetectorDataset.TRANSACTIONS:
      return TransactionsConfig;
    case DetectorDataset.RELEASES:
      return ReleasesConfig;
    default:
      return ErrorsConfig;
  }
}

function getAggregateOptions(
  dataset: DetectorDataset,
  tableFieldOptions: any
): Array<[string, string]> {
  // For spans dataset, use the predefined aggregates
  if (dataset === DetectorDataset.SPANS) {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => [aggregate, aggregate]);
  }

  // For other datasets, extract function-type options from tableFieldOptions
  const functionOptions = Object.values(tableFieldOptions)
    .filter((option: any) => option.value?.kind === 'function')
    .map(
      (option: any) =>
        [option.value.meta.name, option.value.meta.name] as [string, string]
    );

  // If no function options available, fall back to the predefined aggregates
  if (functionOptions.length === 0) {
    return ALLOWED_EXPLORE_VISUALIZE_AGGREGATES.map(aggregate => [aggregate, aggregate]);
  }

  return functionOptions.sort((a, b) => a[1].localeCompare(b[1]));
}

export function Visualize() {
  const organization = useOrganization();
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const tags = useTags();
  const {tags: numericSpanTags} = useTraceItemTags('number');
  const {tags: stringSpanTags} = useTraceItemTags('string');

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);

  const tableFieldOptions = useMemo(
    () => datasetConfig.getTableFieldOptions(organization, tags),
    [organization, tags, datasetConfig]
  );

  const fieldOptions = useMemo(() => {
    // For Spans dataset, use span-specific options from the provider
    if (dataset === DetectorDataset.SPANS) {
      const spanColumnOptions = [
        ...Object.values(stringSpanTags).map(tag => [tag.key, prettifyTagKey(tag.name)]),
        ...Object.values(numericSpanTags).map(tag => [tag.key, prettifyTagKey(tag.name)]),
      ] as Array<[string, string]>;
      return spanColumnOptions.sort((a, b) => a[1].localeCompare(b[1]));
    }

    // For other datasets, use the table field options
    return Object.values(tableFieldOptions)
      .filter(
        option =>
          option.value.kind !== 'function' && // Exclude functions for field selection
          option.value.kind !== 'equation' // Exclude equations
      )
      .map(option => [option.value.meta.name, option.value.meta.name] as [string, string])
      .sort((a, b) => a[1].localeCompare(b[1]));
  }, [dataset, stringSpanTags, numericSpanTags, tableFieldOptions]);

  const aggregateOptions: Array<[string, string]> = useMemo(() => {
    return getAggregateOptions(dataset, tableFieldOptions);
  }, [dataset, tableFieldOptions]);

  return (
    <FirstRow>
      <Flex flex={1} gap={space(1)} align="flex-end">
        <AggregateField
          placeholder={t('aggregate')}
          flexibleControlStateSize
          inline={false}
          label={
            <Tooltip title={t('Primary Metric')} skipWrapper>
              <SectionLabel>{t('Visualize')}</SectionLabel>
            </Tooltip>
          }
          name={METRIC_DETECTOR_FORM_FIELDS.aggregate}
          choices={aggregateOptions}
        />
        <VisualizeField
          placeholder={t('Metric')}
          flexibleControlStateSize
          name={METRIC_DETECTOR_FORM_FIELDS.visualize}
          choices={fieldOptions}
        />
      </Flex>
      <Flex flex={1} gap={space(1)}>
        <FilterField />
      </Flex>
    </FirstRow>
  );
}

const FirstRow = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: 1fr 2fr;
  gap: ${space(1)};
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(2)} ${space(2)};
  background-color: ${p => p.theme.backgroundSecondary};
`;

const VisualizeField = styled(SelectField)`
  flex: 2;
  padding: 0;
  margin: 0;
  border: none;

  > div {
    padding-left: 0;
  }
`;

const AggregateField = styled(SelectField)`
  width: 120px;
  padding: 0;
  margin: 0;
  border: none;

  > div {
    padding-left: 0;
  }
`;

function FilterField() {
  const initialQuery = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  return (
    <Flex direction="column" gap={space(0.5)} flex={1}>
      <Tooltip title={t('Filter')} skipWrapper>
        <SectionLabel>{t('Filter')}</SectionLabel>
      </Tooltip>
      <SearchQueryBuilder
        initialQuery={initialQuery}
        filterKeySections={FILTER_KEY_SECTIONS}
        filterKeys={FILTER_KEYS}
        getTagValues={getTagValues}
        searchSource="detectors"
      />
    </Flex>
  );
}

const getTagValues = (): Promise<string[]> => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(['foo', 'bar', 'baz']);
    }, 500);
  });
};

// TODO: replace hardcoded tags with data from API
const FILTER_KEYS: TagCollection = {
  [FieldKey.ASSIGNED]: {
    key: FieldKey.ASSIGNED,
    name: 'Assigned To',
    kind: FieldKind.FIELD,
    predefined: true,
    values: [
      {
        title: 'Suggested',
        type: 'header',
        icon: null,
        children: [{value: 'me'}, {value: 'unassigned'}],
      },
      {
        title: 'All',
        type: 'header',
        icon: null,
        children: [{value: 'person1@sentry.io'}, {value: 'person2@sentry.io'}],
      },
    ],
  },
  [FieldKey.BROWSER_NAME]: {
    key: FieldKey.BROWSER_NAME,
    name: 'Browser Name',
    kind: FieldKind.FIELD,
    predefined: true,
    values: ['Chrome', 'Firefox', 'Safari', 'Edge', 'Internet Explorer', 'Opera 1,2'],
  },
  [FieldKey.IS]: {
    key: FieldKey.IS,
    name: 'is',
    predefined: true,
    values: ['resolved', 'unresolved', 'ignored'],
  },
  [FieldKey.LAST_SEEN]: {
    key: FieldKey.LAST_SEEN,
    name: 'lastSeen',
    kind: FieldKind.FIELD,
  },
  [FieldKey.TIMES_SEEN]: {
    key: FieldKey.TIMES_SEEN,
    name: 'timesSeen',
    kind: FieldKind.FIELD,
  },
  [WebVital.LCP]: {
    key: WebVital.LCP,
    name: 'lcp',
    kind: FieldKind.FIELD,
  },
  [MobileVital.FRAMES_SLOW_RATE]: {
    key: MobileVital.FRAMES_SLOW_RATE,
    name: 'framesSlowRate',
    kind: FieldKind.FIELD,
  },
  custom_tag_name: {
    key: 'custom_tag_name',
    name: 'Custom_Tag_Name',
  },
};

const FILTER_KEY_SECTIONS: FilterKeySection[] = [
  {
    value: 'cat_1',
    label: 'Category 1',
    children: [FieldKey.ASSIGNED, FieldKey.IS],
  },
  {
    value: 'cat_2',
    label: 'Category 2',
    children: [WebVital.LCP, MobileVital.FRAMES_SLOW_RATE],
  },
  {
    value: 'cat_3',
    label: 'Category 3',
    children: [FieldKey.TIMES_SEEN],
  },
];
