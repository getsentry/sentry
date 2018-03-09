import React from 'react';
import createReactClass from 'create-react-class';
import {Link} from 'react-router';
import SentryTypes from '../proptypes';
import ApiMixin from '../mixins/apiMixin';
import Count from '../components/count';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {percent, deviceNameMapper} from '../utils';
import {t} from '../locale';
import withEnvironment from '../utils/withEnvironment';

const GroupTags = createReactClass({
  displayName: 'GroupTags',

  propTypes: {
    environment: SentryTypes.Environment,
  },

  mixins: [ApiMixin, GroupState],

  getInitialState() {
    return {
      tagList: null,
      loading: true,
      error: false,
      environment: this.props.environment,
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.environment !== this.props.environment) {
      this.setState({environment: nextProps.environment}, this.fetchData);
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    const query = {};
    if (this.state.environment) {
      query.environment = this.state.environment.name;
    }

    // TODO(dcramer): each tag should be a separate query as the tags endpoint
    // is not performant
    this.api.request('/issues/' + this.getGroup().id + '/tags/', {
      query,
      success: data => {
        this.setState({
          tagList: data,
          error: false,
          loading: false,
        });
      },
      error: error => {
        this.setState({
          error: true,
          loading: false,
        });
      },
    });
  },

  getTagsDocsUrl() {
    return 'https://docs.sentry.io/hosted/learn/context/';
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let children = [];

    let orgId = this.getOrganization().slug;
    let projectId = this.getProject().slug;
    let groupId = this.getGroup().id;

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        let valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          let pct = percent(tagValue.count, tag.totalValues);
          return (
            <li key={tagValueIdx}>
              <Link
                className="tag-bar"
                to={{
                  pathname: `/${orgId}/${projectId}/issues/${groupId}/events/`,
                  query: {query: tag.key + ':' + '"' + tagValue.value + '"'},
                }}
              >
                <span className="tag-bar-background" style={{width: pct + '%'}} />
                <span className="tag-bar-label">{deviceNameMapper(tagValue.name)}</span>
                <span className="tag-bar-count">
                  <Count value={tagValue.count} />
                </span>
              </Link>
            </li>
          );
        });

        return (
          <div className="col-md-6" key={tagIdx}>
            <div className="box">
              <div className="box-header">
                <span className="pull-right">
                  <Link
                    className="btn btn-default btn-sm"
                    to={`/${orgId}/${projectId}/issues/${groupId}/tags/${tag.key}/`}
                  >
                    {t('More Details')}
                  </Link>
                </span>
                <h5>{tag.name}</h5>
              </div>
              <div className="box-content with-padding">
                <ul className="list-unstyled">{valueChildren}</ul>
              </div>
            </div>
          </div>
        );
      });
    }

    return (
      <div className="row">
        {children}

        <div className="col-md-12">
          <div className="alert alert-block alert-info">
            Tags are automatically indexed for searching and breakdown charts. Learn how
            to <a href={this.getTagsDocsUrl()}>add custom tags to issues</a>.
          </div>
        </div>
      </div>
    );
  },
});

export default withEnvironment(GroupTags);
