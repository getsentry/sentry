import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import ErrorBoundary from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Activity, Organization} from 'sentry/types';
import routeTitle from 'sentry/utils/routeTitle';
import withOrganization from 'sentry/utils/withOrganization';
import DeprecatedAsyncView, {
  AsyncViewProps,
  AsyncViewState,
} from 'sentry/views/deprecatedAsyncView';

import ActivityFeedItem from './activityFeedItem';

interface Props extends AsyncViewProps {
  organization: Organization;
}

interface State extends AsyncViewState {
  activity: Activity[];
}

class OrganizationActivity extends DeprecatedAsyncView<Props, State> {
  getTitle() {
    const {organization} = this.props;
    return routeTitle(t('Activity'), organization.slug, false);
  }

  getEndpoints(): ReturnType<DeprecatedAsyncView['getEndpoints']> {
    const {organization} = this.props;
    return [['activity', `/organizations/${organization.slug}/activity/`]];
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
            <Layout.Title>{t('Activity')}</Layout.Title>
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

export default withOrganization(OrganizationActivity);
