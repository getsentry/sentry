import {Fragment, useCallback} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import Alert from 'sentry/components/alert';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {hasCustomMetricsExtractionRules} from 'sentry/utils/metrics/features';
import routeTitleGen from 'sentry/utils/routeTitle';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TextBlock from 'sentry/views/settings/components/text/textBlock';
import {
  type FormData,
  MetricsExtractionRuleForm,
} from 'sentry/views/settings/projectMetrics/metricsExtractionRuleForm';
import {
  type MetricsExtractionRule,
  useCreateMetricsExtractionRules,
} from 'sentry/views/settings/projectMetrics/utils/api';

const INITIAL_DATA: FormData = {
  spanAttribute: null,
  type: 'c',
  tags: ['release', 'environment'],
  conditions: [''],
};

const PAGE_TITLE = t('Extract Metric');

function ExtractMetric({project}: {project: Project}) {
  const navigate = useNavigate();
  const organization = useOrganization();
  const createExtractionRuleMutation = useCreateMetricsExtractionRules(
    organization.slug,
    project.slug
  );

  const handleSubmit = useCallback(
    (
      formData: FormData,
      onSubmitSuccess: (data: FormData) => void,
      onSubmitError: (error: any) => void
    ) => {
      const data = formData as FormData;

      const extractionRule: MetricsExtractionRule = {
        spanAttribute: data.spanAttribute!,
        tags: data.tags,
        type: data.type!,
        unit: 'none',
        conditions: data.conditions.filter(Boolean),
      };

      createExtractionRuleMutation.mutate(
        {
          metricsExtractionRules: [extractionRule],
        },
        {
          onSuccess: () => {
            onSubmitSuccess(data);
            addSuccessMessage(t('Metric extraction rule created'));
            navigate(-1);
          },
          onError: error => {
            const message = error?.responseJSON?.detail
              ? (error.responseJSON.detail as string)
              : t('Unable to save your changes.');
            onSubmitError(message);
            addErrorMessage(message);
          },
        }
      );
      onSubmitSuccess(data);
    },
    [createExtractionRuleMutation, navigate]
  );

  if (!hasCustomMetricsExtractionRules(organization)) {
    return <Alert type="warning">{t("You don't have access to this feature")}</Alert>;
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
          <MetricsExtractionRuleForm
            project={project}
            initialData={INITIAL_DATA}
            onCancel={() => navigate(-1)}
            submitLabel={t('Confirm')}
            onSubmit={handleSubmit}
            requireChanges
          />
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

export default ExtractMetric;
