import React from 'react';

import {Activity, Organization} from 'app/types';
import {t} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingIndicator from 'app/components/loadingIndicator';
import routeTitle from 'app/utils/routeTitle';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import ActivityFeedItem from 'app/views/organizationActivity/activityFeedItem';

import Card from './index';

type Props = {
  organization: Organization;
} & Card['props'] &
  AsyncComponent['props'];

type State = {
  activity: Activity[];
} & AsyncComponent['state'];

class OrganizationActivity extends AsyncComponent<Props, State> {
  getTitle() {
    return routeTitle(t('Activity'), this.props.organization.slug);
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    return [['activity', `/organizations/${this.props.organization.slug}/activity/`]];
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

  renderError(error?: Error, disableLog = false, disableReport = false): React.ReactNode {
    const {errors} = this.state;
    const notFound = Object.values(errors).find(resp => resp && resp.status === 404);
    if (notFound) {
      return this.renderBody();
    }
    return super.renderError(error, disableLog, disableReport);
  }

  renderBody() {
    const {loading, activity} = this.state;

    return (
      <Card {...this.props} columnSpan={1} isRemovable={false}>
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
                <ActivityFeedItem organization={this.props.organization} item={item} />
              </ErrorBoundary>
            ))}
          </div>
        )}
      </Card>
    );
  }
}

export default withOrganization(OrganizationActivity);
