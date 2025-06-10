import {useCallback, useState} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import Form from 'sentry/components/forms/form';
import FormModel from 'sentry/components/forms/model';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {PriorityLevel} from 'sentry/types/group';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import {
  getDetectorFromMetricDetectorForm,
  type MetricDetectorFormData,
} from 'sentry/views/detectors/components/forms/metricFormData';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

const DEFAULT_THRESHOLD_METRIC_FORM_DATA = {
  aggregate: 'p75',
  kind: 'threshold',
  query: '',
  name: 'New Monitor',
  initialLevel: PriorityLevel.LOW,
  conditionType: 'gt',
  conditionValue: '',
  conditionComparisonAgo: '1 hour',
  visualize: 'span.duration',

  // Set
  environment: '',
  projectId: '',
} satisfies MetricDetectorFormData;

export default function DetectorNewSettings() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const navigate = useNavigate();
  const location = useLocation();
  const [model] = useState(
    () =>
      new FormModel({
        initialData: {
          ...DEFAULT_THRESHOLD_METRIC_FORM_DATA,
          projectId: location.query.project as string,
          environment: location.query.environment as string,
        },
      })
  );

  const {mutateAsync: createDetector} = useCreateDetector();

  const handleSubmit = useCallback(async () => {
    const isValid = model.validateForm();
    if (!isValid) {
      return;
    }

    const data = model.getData() as unknown as MetricDetectorFormData;
    console.log({data, transformed: getDetectorFromMetricDetectorForm(data)});
    const result = await createDetector(getDetectorFromMetricDetectorForm(data));

    navigate(makeMonitorDetailsPathname(organization.slug, result.id));
  }, [createDetector, model, navigate, organization]);

  return (
    <Form hideFooter model={model} onSubmit={handleSubmit}>
      <NewDetectorLayout>
        <MetricDetectorForm />
        <StickyFooter>
          <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
          <Flex gap={space(1)}>
            <LinkButton
              priority="default"
              to={`${makeMonitorBasePathname(organization.slug)}new/`}
            >
              {t('Back')}
            </LinkButton>
            <Button priority="primary" type="submit">
              {t('Create Monitor')}
            </Button>
          </Flex>
        </StickyFooter>
      </NewDetectorLayout>
    </Form>
  );
}
