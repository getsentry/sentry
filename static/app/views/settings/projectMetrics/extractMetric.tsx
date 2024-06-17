import {Fragment, useState} from 'react';

import Alert from 'sentry/components/alert';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {MetricType} from 'sentry/types/metrics';
import type {Project} from 'sentry/types/project';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import {
  type FormattingSupportedMetricUnit,
  formattingSupportedMetricUnitsSingular,
} from 'sentry/utils/metrics/formatters';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';

interface FormData {
  metricType: MetricType | null;
  spanAttribute: string | null;
  tags: string[];
  unit: FormattingSupportedMetricUnit;
}

const INITIAL_DATA: FormData = {
  spanAttribute: null,
  metricType: 'c',
  tags: [],
  unit: 'none',
};

const PAGE_TITLE = t('Extract Metric');

const TYPE_OPTIONS = [
  {label: t('Counter'), value: 'c'},
  {label: t('Gauge'), value: 'g'},
  {label: t('Set'), value: 's'},
  {label: t('Distribution'), value: 'd'},
];

const UNIT_OPTIONS = formattingSupportedMetricUnitsSingular.map(value => ({
  label: value,
  value,
}));

function ExtractMetric({project}: {project: Project}) {
  const navigate = useNavigate();
  const [isUsingCounter, setIsUsingCounter] = useState(INITIAL_DATA.metricType === 'c');
  const organization = useOrganization();

  if (!hasCustomMetricsExtractionRules(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
  }

  function handleSubmit(
    formData: Record<string, any>,
    onSubmitSuccess: (data: Record<string, any>) => void
  ) {
    const data = formData as FormData;
    // TODO BE request
    onSubmitSuccess(data);
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={routeTitleGen(PAGE_TITLE, project.slug, false)} />
      <SettingsPageHeader title={PAGE_TITLE} />
      <TextBlock>
        {t(
          'Metric Extraction Rules enable you to derive meaningful metrics from the attributes present on spans within your application.'
        )}
      </TextBlock>
      <TextBlock>
        {t(
          "By defining these rules, you can specify how and which attributes should be processed to generate useful metrics that provide detailed insights into your application's performance and behavior."
        )}
      </TextBlock>
      <Panel>
        <PanelHeader>{t('Create Extraction Rule')}</PanelHeader>
        <PanelBody>
          <Form
            initialData={INITIAL_DATA}
            onCancel={() => navigate(-1)}
            submitLabel={t('Confirm')}
            onFieldChange={(name, value) => {
              if (name === 'metricType') {
                setIsUsingCounter(value === 'c');
              }
            }}
            onSubmit={handleSubmit}
            requireChanges
          >
            {({model}) => (
              <Fragment>
                <SelectField
                  name="spanAttribute"
                  required
                  options={[
                    {label: 'attribute1', value: 'attribute1'},
                    {label: 'attribute2', value: 'attribute2'},
                    {label: 'attribute3', value: 'attribute3'},
                    {label: 'attribute4', value: 'attribute4'},
                  ]}
                  label="Span Attribute"
                  help={t('The span attribute to extract the metric from.')}
                />
                <SelectField
                  name="metricType"
                  options={TYPE_OPTIONS}
                  onChange={(value: string) => {
                    if (value === 'c') {
                      model.setValue('unit', 'none');
                    }
                  }}
                  label="Type"
                  help={t(
                    'The type of the metric determines which aggregation functions are available and what types of values it can store. For more information, read our docs'
                  )}
                />
                <SelectField
                  name="unit"
                  disabled={isUsingCounter}
                  disabledReason={t('Counters do not support units')}
                  options={UNIT_OPTIONS}
                  label="Unit"
                  help={t(
                    'The unit of the metric. This will be used to format the metric values in the UI.'
                  )}
                />
                <SelectField
                  name="tags"
                  options={[
                    {label: 'tag1', value: 'tag1'},
                    {label: 'tag2', value: 'tag2'},
                    {label: 'tag3', value: 'tag3'},
                    {label: 'tag4', value: 'tag4'},
                  ]}
                  label="Tags"
                  multiple
                  help={t(
                    'Those tags will be stored with the metric. They can be used to filter and group the metric in the UI.'
                  )}
                />
              </Fragment>
            )}
          </Form>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default ExtractMetric;
