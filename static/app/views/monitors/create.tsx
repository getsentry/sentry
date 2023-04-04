import {Fragment} from 'react';
import {browserHistory} from 'react-router';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import AsyncView from 'sentry/views/asyncView';

import CronsFeedbackButton from './components/cronsFeedbackButton';
import MonitorForm from './components/monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] & {
  organization: Organization;
};

const CreateMonitor = ({}: Props) => {
  const {slug: orgSlug} = useOrganization();

  function onSubmitSuccess(data: Monitor) {
    const url = normalizeUrl(`/organizations/${orgSlug}/crons/${data.slug}/`);
    browserHistory.push(url);
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
          <CronsFeedbackButton />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <MonitorForm
            apiMethod="POST"
            apiEndpoint={`/organizations/${orgSlug}/monitors/`}
            onSubmitSuccess={onSubmitSuccess}
            submitLabel={t('Next')}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
};

export default CreateMonitor;
