import React from 'react';
import {Link} from 'react-router';

import ActivityFeed from 'app/components/activity/feed';
import {t} from 'app/locale';

export default class Activity extends React.Component {
  getEndpoint = () => {
    return `/organizations/${this.props.params.orgId}/activity/`;
  };

  refresh = () => {
    this.refs.activityFeed.remountComponent();
  };

  getViewMoreLink() {
    return `/organizations/${this.props.params.orgId}/activity/`;
  }

  render() {
    return (
      <div>
        <div className="pull-right">
          <Link className="btn btn-sm btn-default" to={this.getViewMoreLink()}>
            {t('View more')}
          </Link>
          <a
            className="btn btn-sm btn-default"
            style={{marginLeft: 5}}
            onClick={this.refresh}
          >
            <span className="icon icon-refresh" />
          </a>
        </div>
        <h4>{t('Recent activity')}</h4>
        <ActivityFeed
          ref="activityFeed"
          endpoint={this.getEndpoint()}
          query={{
            per_page: 10,
          }}
          pagination={false}
          {...this.props}
        />
      </div>
    );
  }
}
