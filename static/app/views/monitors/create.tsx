import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import AsyncView from 'sentry/views/asyncView';

import MonitorForm from './monitorForm';
import {Monitor} from './types';

type Props = AsyncView['props'] & RouteComponentProps<{orgId: string}, {}>;

export default class CreateMonitor extends AsyncView<Props, AsyncView['state']> {
  getTitle() {
    return `Monitors - ${this.props.params.orgId}`;
  }

  onSubmitSuccess = (data: Monitor) => {
    browserHistory.push(`/organizations/${this.props.params.orgId}/monitors/${data.id}/`);
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
            apiEndpoint={`/organizations/${this.props.params.orgId}/monitors/`}
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
