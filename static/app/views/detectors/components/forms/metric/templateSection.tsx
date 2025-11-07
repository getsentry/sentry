import {useContext, useMemo} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Heading} from 'sentry/components/core/text/heading';
import SelectField from 'sentry/components/forms/fields/selectField';
import FormContext from 'sentry/components/forms/formContext';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {t} from 'sentry/locale';
import {
  AlertWizardAlertNames,
  AlertWizardRuleTemplates,
  type AlertType,
  type MetricAlertType,
} from 'sentry/views/alerts/wizard/options';
import {METRIC_DETECTOR_FORM_FIELDS} from 'sentry/views/detectors/components/forms/metric/metricFormData';
import {useDatasetChoices} from 'sentry/views/detectors/components/forms/metric/useDatasetChoices';
import {getDatasetConfig} from 'sentry/views/detectors/datasetConfig/getDatasetConfig';
import {getDetectorDataset} from 'sentry/views/detectors/datasetConfig/getDetectorDataset';

export function TemplateSection() {
  const formContext = useContext(FormContext);
  const datasetChoices = useDatasetChoices();
  const allowedDatasets = useMemo(
    () => new Set(datasetChoices.map(choice => choice.value)),
    [datasetChoices]
  );

  // Build template options filtered to allowed datasets/features
  const templateOptions = useMemo(() => {
    const entries = Object.entries(AlertWizardRuleTemplates) as Array<
      [MetricAlertType, (typeof AlertWizardRuleTemplates)[MetricAlertType]]
    >;

    return entries
      .map(([key, tpl]) => {
        const detectorDataset = getDetectorDataset(tpl.dataset, [tpl.eventTypes]);
        return {
          key,
          detectorDataset,
          label: AlertWizardAlertNames[key as unknown as AlertType] ?? key,
          aggregate: tpl.aggregate,
          query: tpl.query ?? '',
        };
      })
      .filter(opt => allowedDatasets.has(opt.detectorDataset))
      .map(opt => ({
        value: opt.key,
        label: opt.label,
      }));
  }, [allowedDatasets]);

  const templateMetaByKey = useMemo(() => {
    const entries = Object.entries(AlertWizardRuleTemplates) as Array<
      [MetricAlertType, (typeof AlertWizardRuleTemplates)[MetricAlertType]]
    >;
    const metas = entries
      .map(([key, tpl]) => {
        const detectorDataset = getDetectorDataset(tpl.dataset, [tpl.eventTypes]);
        return {
          key,
          detectorDataset,
          label: AlertWizardAlertNames[key as unknown as AlertType] ?? key,
          aggregate: tpl.aggregate,
          query: tpl.query ?? '',
        };
      })
      .filter(opt => allowedDatasets.has(opt.detectorDataset));
    return Object.fromEntries(metas.map(m => [m.key, m]));
  }, [allowedDatasets]);

  // No templates available, skip rendering
  if (!templateOptions.length) {
    return null;
  }

  return (
    <Container>
      <Flex direction="column" gap="xs">
        <Heading as="h3">{t('Choose Your Metric')}</Heading>
        <TemplateField
          name="_metric_template"
          inline={false}
          flexibleControlStateSize
          preserveOnUnmount
          allowClear
          placeholder={t('Choose a template (optional)')}
          options={templateOptions}
          onChange={_value => {
            if (!_value) {
              return;
            }
            const key = _value as MetricAlertType;
            const meta = templateMetaByKey[key];
            if (!meta) {
              return;
            }

            // Apply selected template values
            const datasetConfig = getDatasetConfig(meta.detectorDataset);
            const uiAggregate = datasetConfig.fromApiAggregate(meta.aggregate);
            formContext.form?.setValue(
              METRIC_DETECTOR_FORM_FIELDS.dataset,
              meta.detectorDataset
            );
            formContext.form?.setValue(
              METRIC_DETECTOR_FORM_FIELDS.aggregateFunction,
              uiAggregate
            );
            formContext.form?.setValue(METRIC_DETECTOR_FORM_FIELDS.query, meta.query);
          }}
        />
      </Flex>
    </Container>
  );
}

const TemplateField = styled(SelectField)`
  max-width: 420px;
  padding: 0;
  margin-left: 0;
  border-bottom: none;

  > div {
    padding-left: 0;
  }
`;
