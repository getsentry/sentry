import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import type {DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {NewDetectorForm} from 'sentry/views/detectors/components/forms';
import {DETECTOR_TYPE_LABELS} from 'sentry/views/detectors/constants';

export default function DetectorNewSettings() {
  const location = useLocation();
  const {fetching: isFetchingProjects} = useProjects();
  const detectorType = location.query.detectorType as DetectorType;
  useWorkflowEngineFeatureGate({redirect: true});

  if (isFetchingProjects) {
    return (
      <Layout.Page>
        <Layout.Body>
          <Layout.Main fullWidth>
            <LoadingIndicator />
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle
        title={t('New %s Monitor', DETECTOR_TYPE_LABELS[detectorType])}
      />
      <NewDetectorForm detectorType={detectorType} />
    </Fragment>
  );
}
