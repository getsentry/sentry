/* eslint-disable no-alert */
import {Fragment} from 'react';

import {Button, LinkButton} from 'sentry/components/button';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ActionsProvider} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsProvider} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import DetailLayout from 'sentry/components/workflowEngine/layout/detail';
import {useWorkflowEngineFeatureGate} from 'sentry/components/workflowEngine/useWorkflowEngineFeatureGate';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';

export default function AutomationDetail() {
  useWorkflowEngineFeatureGate({redirect: true});

  return (
    <SentryDocumentTitle title={t('Automation')} noSuffix>
      <BreadcrumbsProvider crumb={{label: t('Automations'), to: '/automations'}}>
        <ActionsProvider actions={<Actions />}>
          <DetailLayout project={{slug: 'project-slug', platform: 'javascript-astro'}}>
            <DetailLayout.Main>main</DetailLayout.Main>
            <DetailLayout.Sidebar>sidebar</DetailLayout.Sidebar>
          </DetailLayout>
        </ActionsProvider>
      </BreadcrumbsProvider>
    </SentryDocumentTitle>
  );
}

function Actions() {
  const disable = () => {
    window.alert('disable');
  };
  return (
    <Fragment>
      <Button onClick={disable}>{t('Disable')}</Button>
      <LinkButton to="/monitors/edit" priority="primary" icon={<IconEdit />}>
        {t('Edit')}
      </LinkButton>
    </Fragment>
  );
}
