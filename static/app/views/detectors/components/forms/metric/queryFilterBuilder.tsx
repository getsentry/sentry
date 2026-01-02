import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Tooltip} from 'sentry/components/core/tooltip';
import FormContext from 'sentry/components/forms/formContext';
import FormField from 'sentry/components/forms/formField';
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
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';

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

  const projectIds = useMemo(() => {
    if (projectId) {
      return [Number(projectId)];
    }
    return [];
  }, [projectId]);

  return (
    <NoPaddingFormField
      name={METRIC_DETECTOR_FORM_FIELDS.query}
      inline={false}
      flexibleControlStateSize
      preserveOnUnmount
      label={t('Filter')}
      hideLabel
      disabled={dataset === DetectorDataset.TRANSACTIONS}
    >
      {({ref: _ref, ...fieldProps}) => (
        <Flex direction="column" gap="xs" flex={1}>
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
              dataset={datasetConfig.getDiscoverDataset()}
              environment={environment}
              {...fieldProps}
            />
          </QueryFieldRowWrapper>
        </Flex>
      )}
    </NoPaddingFormField>
  );
}

const NoPaddingFormField = styled(FormField)`
  padding: 0;
  width: 100%;
`;

const QueryFieldRowWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  margin-bottom: ${space(1)};
  align-items: center;
`;
