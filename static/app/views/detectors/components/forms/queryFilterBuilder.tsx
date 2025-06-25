import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormContext from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PageFilters} from 'sentry/types/core';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {getDatasetConfig} from 'sentry/views/detectors/components/forms/getDatasetConfig';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {
  SectionLabel,
  SectionLabelSecondary,
} from 'sentry/views/detectors/components/forms/sectionLabel';

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
    (): PageFilters => ({
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
    (): WidgetQuery => ({
      conditions: currentQuery || '',
      aggregates: [],
      columns: [],
      fieldAliases: [],
      name: '',
      orderby: '',
    }),
    [currentQuery]
  );

  return (
    <Flex direction="column" gap={space(0.5)} flex={1}>
      <div>
        <Tooltip
          title={t(
            'Filter down your search here. You can add multiple queries to compare data for each overlay.'
          )}
          showUnderline
        >
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>{' '}
        <SectionLabelSecondary>({t('optional')})</SectionLabelSecondary>
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
