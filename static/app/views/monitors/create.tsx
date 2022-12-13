import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] &
  RouteComponentProps<{orgId: string}, {}> & {
    organization: Organization;
  };

class CreateMonitor extends AsyncView<Props, AsyncView['state']> {
  getTitle() {
    return `Monitors - ${this.orgSlug}`;
  }

  get orgSlug() {
    return this.props.organization.slug;
  }

  onSubmitSuccess = (data: Monitor) => {
    const url = normalizeUrl(`/organizations/${this.orgSlug}/monitors/${data.id}/`);
    browserHistory.push(url);
  };

  renderBody() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <h1>{t('Set Up Cron Monitor')}</h1>
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
    );
  }
}
export default withOrganization(CreateMonitor);

const HelpText = styled('p')`
  color: ${p => p.theme.subText};
  max-width: 760px;
`;
