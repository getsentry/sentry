/* eslint-disable no-alert */
import {Fragment} from 'react';

import {Button} from 'sentry/components/core/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import EditLayout from 'sentry/components/workflowEngine/layout/edit';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import {makeAutomationBasePathname} from 'sentry/views/automations/pathnames';

export default function AutomationEdit() {
  const organization = useOrganization();
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Edit Automation')} noSuffix>
      <BreadcrumbsProvider
        crumb={{
          label: t('Automations'),
          to: makeAutomationBasePathname(organization.slug),
        }}
      >
        <ActionsProvider actions={<Actions />}>
          <EditLayout>
            <h2>Edit Automation</h2>
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
