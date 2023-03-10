import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

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

function CreateMonitor({}: Props) {
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
                label: t('Set Up Cron Monitor'),
              },
            ]}
          />
          <Layout.Title>{t('Set Up Cron Monitor')}</Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <CronsFeedbackButton />
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <HelpText>
            {t(
              `Sentry will tell you if your recurring jobs are running on schedule, failing, or succeeding.`
            )}
          </HelpText>
          <MonitorForm
            apiMethod="POST"
            apiEndpoint={`/organizations/${orgSlug}/monitors/`}
            onSubmitSuccess={onSubmitSuccess}
            submitLabel={t('Next Steps')}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default CreateMonitor;

const HelpText = styled('p')`
  color: ${p => p.theme.subText};
  max-width: 760px;
`;
