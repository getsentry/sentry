import {Fragment} from 'react';
import type {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import AsyncComponent from 'sentry/components/asyncComponent';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import Button from 'sentry/components/button';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import {IssueAlertRule} from 'sentry/types/alerts';

import AlertChart from './alertChart';
import Sidebar from './sidebar';

type Props = AsyncComponent['props'] & {
  organization: Organization;
} & RouteComponentProps<{orgId: string; projectId: string; ruleId: string}, {}>;

type State = AsyncComponent['state'] & {
  rule: IssueAlertRule | null;
};

class TeamStability extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      rule: null,
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {orgId, ruleId, projectId} = this.props.params;
    return [['rule', `/projects/${orgId}/${projectId}/rules/${ruleId}/`]];
  }

  renderLoading() {
    return (
      <StyledLayoutBody>
        <Layout.Main fullWidth>
          <LoadingIndicator />
        </Layout.Main>
      </StyledLayoutBody>
    );
  }

  renderBody() {
    const {organization} = this.props;
    const {orgId, ruleId, projectId} = this.props.params;
    const {rule} = this.state;

    if (!rule) {
      return <LoadingError message={t('There was an error loading the alert rule.')} />;
    }

    return (
      <Fragment>
        <Layout.Header>
          <Layout.HeaderContent>
            <Breadcrumbs
              crumbs={[
                {label: t('Alerts'), to: `/organizations/${orgId}/alerts/rules/`},
                {label: t('Alert Rule'), to: null},
              ]}
            />
            <Layout.Title>{rule.name}</Layout.Title>
          </Layout.HeaderContent>
          <Layout.HeaderActions>
            <Button
              icon={<IconEdit />}
              to={`/organizations/${orgId}/alerts/rules/${projectId}/${ruleId}/`}
            >
              {t('Edit Rule')}
            </Button>
          </Layout.HeaderActions>
        </Layout.Header>
        <StyledLayoutBody>
          <Layout.Main>
            <AlertChart organization={organization} orgId={orgId} />
          </Layout.Main>
          <Layout.Side>
            <Sidebar rule={rule} />
          </Layout.Side>
        </StyledLayoutBody>
      </Fragment>
    );
  }
}

export default TeamStability;

const StyledLayoutBody = styled(Layout.Body)`
  margin-bottom: -20px;
`;
