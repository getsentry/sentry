import PropTypes from 'prop-types';
import React from 'react';

import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import ErrorBoundary from 'app/components/errorBoundary';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Pagination from 'app/components/pagination';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

import ActivityFeedItem from './activityFeedItem';

class ActivityFeed extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization,
    endpoint: PropTypes.string,
    query: PropTypes.object,
    pagination: PropTypes.bool,
  };

  static defaultProps = {
    pagination: true,
    query: {},
  };

  constructor(props) {
    super(props);
    this.state = {
      itemList: [],
      loading: true,
      error: false,
      pageLinks: null,
    };
  }

  componentWillMount() {
    this.fetchData();
  }

  componentWillReceiveProps(nextProps) {
    const location = this.props.location;
    const nextLocation = nextProps.location;
    if (
      location.pathname !== nextLocation.pathname ||
      location.search !== nextLocation.search
    ) {
      this.setState({
        itemList: [],
        loading: true,
        error: false,
        pageLinks: null,
      });
      this.fetchData();
    }
  }

  fetchData = () => {
    const location = this.props.location;
    this.props.api.clear();
    this.props.api.request(this.props.endpoint, {
      method: 'GET',
      query: {
        cursor: location.query.cursor || '',
        ...this.props.query,
      },
      success: (data, _, jqXHR) => {
        this.setState({
          loading: false,
          error: false,
          itemList: data,
          pageLinks: jqXHR.getResponseHeader('Link'),
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  };

  renderResults() {
    let body;

    if (this.state.loading) {
      body = this.renderLoading();
    } else if (this.state.error) {
      body = <LoadingError onRetry={this.fetchData} />;
    } else if (this.state.itemList.length > 0) {
      body = (
        <div data-test-id="activity-feed-list" className="activity">
          {this.state.itemList.map(item => {
            return (
              <ErrorBoundary
                mini
                css={{marginBottom: space(1), borderRadius: 0}}
                key={item.id}
              >
                <ActivityFeedItem organization={this.props.organization} item={item} />
              </ErrorBoundary>
            );
          })}
        </div>
      );
    } else {
      body = this.renderEmpty();
    }

    return body;
  }

  renderLoading() {
    return <LoadingIndicator />;
  }

  renderEmpty() {
    return (
      <EmptyMessage icon="icon-circle-exclamation">
        {t('Nothing to show here, move along.')}
      </EmptyMessage>
    );
  }

  render() {
    return (
      <React.Fragment>
        <Panel>{this.renderResults()}</Panel>
        {this.props.pagination && this.state.pageLinks && (
          <Pagination pageLinks={this.state.pageLinks} {...this.props} />
        )}
      </React.Fragment>
    );
  }
}

export default withApi(ActivityFeed);
