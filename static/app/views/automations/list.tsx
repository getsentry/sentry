/* eslint-disable no-alert */
import {Fragment} from 'react';

import {Button} from 'sentry/components/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import ListLayout from 'sentry/components/workflowEngine/layout/list';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconAdd} from 'sentry/icons';
import {t} from 'sentry/locale';

export default function AutomationsList() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Automations')} noSuffix>
      <ActionsProvider actions={<Actions />}>
        <ListLayout>
          <h2>Automations</h2>
        </ListLayout>
      </ActionsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  const create = () => {
    window.alert('create');
  };
  return (
    <Fragment>
      <Button onClick={create} priority="primary" icon={<IconAdd isCircled />}>
        {t('Create Automation')}
      </Button>
    </Fragment>
  );
}
