import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as PropTypes from 'prop-types';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import SentryTypes from 'sentry/sentryTypes';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] & RouteComponentProps<{orgId: string}, {}>;

export default class CreateMonitor extends AsyncView<Props, AsyncView['state']> {
  static contextTypes = {
    router: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  getTitle() {
    return `Monitors - ${this.orgSlug}`;
  }

  get orgSlug() {
    return this.context.organization.slug;
  }

  onSubmitSuccess = (data: Monitor) => {
    const url = normalizeUrl(`/organizations/${this.orgSlug}/monitors/${data.id}/`);
    browserHistory.push(url);
  };

  renderBody() {
    return (
      <Layout.Body>
        <Layout.Main fullWidth>
          <h1>{t('New Monitor')}</h1>
          <HelpText>
            {t(
              `Creating a monitor will allow you to track the executions of a scheduled
             job in your organization. For example, ensure a cron job that is
             scheduled to run once a day executes and finishes within a specified
             duration.`
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

const HelpText = styled('p')`
  color: ${p => p.theme.subText};
  max-width: 760px;
`;
