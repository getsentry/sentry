/* eslint-disable no-alert */
import {Fragment, useState} from 'react';

import {Button} from 'sentry/components/core/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import {MetricDetectorForm} from 'sentry/views/detectors/components/forms/metric';

export default function DetectorEdit() {
  useWorkflowEngineFeatureGate({redirect: true});
  const [title, setTitle] = useState(t('My Monitor'));

  return (
    <SentryDocumentTitle title={title} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Monitors'), to: '/issues/monitors'}}>
        <ActionsProvider actions={<Actions />}>
          <EditLayout onTitleChange={setTitle}>
            <MetricDetectorForm />
          </EditLayout>
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  const disable = () => {
    window.alert('disable');
  };
  const del = () => {
    window.alert('delete');
  };
  const save = () => {
    window.alert('save');
  };
  return (
    <Fragment>
      <Button onClick={disable}>{t('Disable')}</Button>
      <Button onClick={del} priority="danger">
        {t('Delete')}
      </Button>
      <Button onClick={save} priority="primary">
        {t('Save')}
      </Button>
    </Fragment>
  );
}
