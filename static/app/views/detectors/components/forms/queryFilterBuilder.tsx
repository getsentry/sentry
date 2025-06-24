import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormContext from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ErrorsConfig} from 'sentry/views/dashboards/datasetConfig/errors';
import {ReleasesConfig} from 'sentry/views/dashboards/datasetConfig/releases';
import {SpansConfig} from 'sentry/views/dashboards/datasetConfig/spans';
import {TransactionsConfig} from 'sentry/views/dashboards/datasetConfig/transactions';
import {
  DetectorDataset,
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {SectionLabel} from 'sentry/views/detectors/components/forms/sectionLabel';

// TODO: consolidate this with the other one
function getDatasetConfig(dataset: DetectorDataset) {
  switch (dataset) {
    case DetectorDataset.ERRORS:
      return ErrorsConfig;
    case DetectorDataset.TRANSACTIONS:
      return TransactionsConfig;
    case DetectorDataset.RELEASES:
      return ReleasesConfig;
    case DetectorDataset.SPANS:
      return SpansConfig;
    default:
      return ErrorsConfig;
  }
}

export function DetectorQueryFilterBuilder() {
  const currentQuery = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const environment = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.environment);
  const formContext = useContext(FormContext);

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const SearchBar = datasetConfig.SearchBar;

  const handleQueryChange = (queryString: string) => {
    formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, queryString);
  };

  // Create mock page filters using form data
  const mockPageFilters = useMemo(
    () => ({
      projects: projectId ? [parseInt(projectId, 10)] : [],
      environments: environment ? [environment] : [],
      datetime: {
        start: null,
        end: null,
        period: '24h',
        utc: false,
      },
    }),
    [projectId, environment]
  );

  // Create a mock widget query for the SearchBar
  const widgetQuery = useMemo(
    () => ({
      aggregates: [],
      columns: [],
      conditions: currentQuery || '',
      fields: [],
      fieldAliases: [],
      groupBy: [],
      id: '',
      name: '',
      orderby: '',
    }),
    [currentQuery]
  );

  return (
    <Flex direction="column" gap={space(0.5)} flex={1}>
      <div>
        <Tooltip title={t('Filter down your search here')} showUnderline>
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>
      </div>
      <QueryFieldRowWrapper>
        <SearchBar
          pageFilters={mockPageFilters}
          onClose={(field: string) => {
            handleQueryChange(field);
          }}
          onSearch={handleQueryChange}
          widgetQuery={widgetQuery}
          portalTarget={document.body}
          getFilterWarning={() => null}
        />
      </QueryFieldRowWrapper>
    </Flex>
  );
}

const QueryFieldRowWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
  align-items: center;
`;
