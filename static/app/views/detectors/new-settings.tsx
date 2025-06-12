import {useCallback, useMemo} from 'react';

import {Flex} from 'sentry/components/container/flex';
import {Button} from 'sentry/components/core/button';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import FormModel from 'sentry/components/forms/model';
import {
  StickyFooter,
  StickyFooterLabel,
} from 'sentry/components/workflowEngine/ui/footer';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';
import {useCreateDetector} from 'sentry/views/detectors/hooks';
import NewDetectorLayout from 'sentry/views/detectors/layouts/new';
import {
  makeMonitorBasePathname,
  makeMonitorDetailsPathname,
} from 'sentry/views/detectors/pathnames';

export default function DetectorNewSettings() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});
  const navigate = useNavigate();
  const model = useMemo(() => new FormModel(), []);

  const {mutateAsync: createDetector} = useCreateDetector();

  const handleSubmit = useCallback(async () => {
    const data = model.getData() as unknown as Detector;
    const result = await createDetector(data);
    navigate(makeMonitorDetailsPathname(organization.slug, result.id));
  }, [createDetector, model, navigate, organization]);

  return (
    <NewDetectorLayout>
      <MetricDetectorForm model={model} />
      <StickyFooter>
        <StickyFooterLabel>{t('Step 2 of 2')}</StickyFooterLabel>
        <Flex gap={space(1)}>
          <LinkButton
            priority="default"
            to={`${makeMonitorBasePathname(organization.slug)}new/`}
          >
            {t('Back')}
          </LinkButton>
          <Button priority="primary" onClick={handleSubmit}>
            {t('Create Monitor')}
          </Button>
        </Flex>
      </StickyFooter>
    </NewDetectorLayout>
  );
}
