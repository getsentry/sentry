import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import CronsFeedbackButton from './cronsFeedbackButton';
import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] & {
  organization: Organization;
};

class CreateMonitor extends AsyncView<Props, AsyncView['state']> {
  getTitle() {
    return `Crons - ${this.orgSlug}`;
  }

  get orgSlug() {
    return this.props.organization.slug;
  }

  onSubmitSuccess = (data: Monitor) => {
    const url = normalizeUrl(`/organizations/${this.orgSlug}/crons/${data.id}/`);
    browserHistory.push(url);
  };

  renderBody() {
    return (
      <Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {
                  label: t('Crons'),
                  to: `/organizations/${this.orgSlug}/crons/`,
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
              apiEndpoint={`/organizations/${this.orgSlug}/monitors/`}
              onSubmitSuccess={this.onSubmitSuccess}
              submitLabel={t('Next Steps')}
            />
          </Layout.Main>
        </Layout.Body>
      </Fragment>
    );
  }
}
export default withOrganization(CreateMonitor);

const HelpText = styled('p')`
  color: ${p => p.theme.subText};
  max-width: 760px;
`;
