import {RouteComponentProps} from 'react-router/lib/Router';
import React from 'react';

import {Activity, Organization} from 'app/types';
import {PageContent} from 'app/styles/organization';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingIndicator from 'app/components/loadingIndicator';
import PageHeading from 'app/components/pageHeading';
import Pagination from 'app/components/pagination';
import routeTitle from 'app/utils/routeTitle';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

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
    return routeTitle(t('Activity'), orgId);
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    return [['activity', `/organizations/${this.props.params.orgId}/activity/`]];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderEmpty() {
    return (
      <EmptyMessage icon="icon-circle-exclamation">
        {t('Nothing to show here, move along.')}
      </EmptyMessage>
    );
  }

  renderBody() {
    const {loading, activity, activityPageLinks} = this.state;

    return (
      <PageContent>
        <PageHeading withMargins>{t('Activity')}</PageHeading>
        <Panel>
          {loading && <LoadingIndicator />}
          {!loading && !activity.length && this.renderEmpty()}
          {!loading && !!activity.length && (
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
        </Panel>
        {activityPageLinks && (
          <Pagination pageLinks={activityPageLinks} {...this.props} />
        )}
      </PageContent>
    );
  }
}

export default withOrganization(OrganizationActivity);
