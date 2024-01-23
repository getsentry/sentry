import {Fragment} from 'react';
import {browserHistory} from 'react-router';

import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import MonitorForm from './components/monitorForm';
import {Monitor} from './types';

function CreateMonitor() {
  const organization = useOrganization();
  const orgSlug = organization.slug;
  const {selection} = usePageFilters();

  const monitorCreationCallbacks = HookStore.get('callback:on-monitor-created');

  function onSubmitSuccess(data: Monitor) {
    const endpointOptions = {
      query: {
        project: selection.projects,
        environment: selection.environments,
      },
    };
    browserHistory.push(
      normalizeUrl({
        pathname: `/organizations/${orgSlug}/crons/${data.slug}/`,
        query: endpointOptions.query,
      })
    );
    monitorCreationCallbacks.map(cb => cb(organization));
  }

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumbs
            crumbs={[
              {
                label: t('Crons'),
                to: `/organizations/${orgSlug}/crons/`,
              },
              {
                label: t('Add Monitor'),
              },
            ]}
          />
          <Layout.Title>{t('Add Monitor')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <FeedbackWidgetButton />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <MonitorForm
            apiMethod="POST"
            apiEndpoint={`/organizations/${orgSlug}/monitors/`}
            onSubmitSuccess={onSubmitSuccess}
            submitLabel={t('Create')}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default CreateMonitor;
