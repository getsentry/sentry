import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormContext from 'sentry/components/forms/formContext';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {
  METRIC_DETECTOR_FORM_FIELDS,
  useMetricDetectorFormField,
} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {
  SectionLabel,
  SectionLabelSecondary,
} from 'sentry/views/detectors/components/forms/sectionLabel';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP} from 'sentry/views/detectors/datasetConfig/utils/discoverDatasetMap';

export function DetectorQueryFilterBuilder() {
  const currentQuery = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.query);
  const dataset = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.dataset);
  const projectId = useMetricDetectorFormField(METRIC_DETECTOR_FORM_FIELDS.projectId);
  const formContext = useContext(FormContext);

  const datasetConfig = useMemo(() => getDatasetConfig(dataset), [dataset]);
  const SearchBar = datasetConfig.SearchBar;

  const handleQueryChange = (queryString: string) => {
    formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, queryString);
  };

  const projectIds = useMemo(() => {
    if (projectId) {
      return [Number(projectId)];
    }
    return [];
  }, [projectId]);

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
          initialQuery={currentQuery}
          projectIds={projectIds}
          onClose={handleQueryChange}
          onSearch={handleQueryChange}
          dataset={DETECTOR_DATASET_TO_DISCOVER_DATASET_MAP[dataset]}
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
