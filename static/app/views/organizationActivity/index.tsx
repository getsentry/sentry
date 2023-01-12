import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import PageHeading from 'sentry/components/pageHeading';
import Pagination from 'sentry/components/pagination';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Activity, Organization} from 'sentry/types';
import routeTitle from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

import ActivityFeedItem from './activityFeedItem';

type Props = {
  organization: Organization;
} & RouteComponentProps<{orgId: string}, {}> &
  AsyncView['props'];

type State = {
  activity: Activity[];
} & AsyncView['state'];

class OrganizationActivity extends AsyncView<Props, State> {
  getTitle() {
    const {orgId} = this.props.params;
    return routeTitle(t('Activity'), orgId, false);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['activity', `/organizations/${this.props.params.orgId}/activity/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmpty() {
    return (
      <EmptyStateWarning>
        <p>{t('Nothing to show here, move along.')}</p>
      </EmptyStateWarning>
    );
  }

  renderError(error?: Error, disableLog = false): React.ReactNode {
    const {errors} = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);
    if (notFound) {
      return this.renderBody();
    }
    return super.renderError(error, disableLog);
  }

  renderBody() {
    const {loading, activity, activityPageLinks} = this.state;

    return (
      <Layout.Page>
        <Layout.Header>
          <Layout.HeaderContent>
            <StyledHeading>{t('Activity')}</StyledHeading>
          </Layout.HeaderContent>
        </Layout.Header>
        <Layout.Body>
          <Layout.Main fullWidth>
            <Panel>
              {loading && <LoadingIndicator />}
              {!loading && !activity?.length && this.renderEmpty()}
              {!loading && activity?.length > 0 && (
                <div data-test-id="activity-feed-list">
                  {activity.map(item => (
                    <ErrorBoundary
                      mini
                      css={{marginBottom: space(1), borderRadius: 0}}
                      key={item.id}
                    >
                      <ActivityFeedItem
                        organization={this.props.organization}
                        item={item}
                      />
                    </ErrorBoundary>
                  ))}
                </div>
              )}
            </Panel>
            {activityPageLinks && (
              <Pagination pageLinks={activityPageLinks} {...this.props} />
            )}
          </Layout.Main>
        </Layout.Body>
      </Layout.Page>
    );
  }
}

const StyledHeading = styled(PageHeading)`
  line-height: 40px;
`;

export default withOrganization(OrganizationActivity);
