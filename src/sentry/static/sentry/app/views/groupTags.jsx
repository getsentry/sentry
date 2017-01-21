import React from 'react';
import {Link} from 'react-router';
import ApiMixin from '../mixins/apiMixin';
import Count from '../components/count';
import GroupState from '../mixins/groupState';
import LoadingError from '../components/loadingError';
import LoadingIndicator from '../components/loadingIndicator';
import {percent, deviceNameMapper} from '../utils';
import {t} from '../locale';

const GroupTags = React.createClass({
  mixins: [
    ApiMixin,
    GroupState
  ],

  getInitialState() {
    return {
      tagList: null,
      loading: true,
      error: false
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    // TODO(dcramer): each tag should be a separate query as the tags endpoint
    // is not performant
    this.api.request('/issues/' + this.getGroup().id + '/tags/', {
      success: (data) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          tagList: data,
          error: false,
          loading: false
        });
      },
      error: (error) => {
        if (!this.isMounted()) {
          return;
        }
        this.setState({
          error: true,
          loading: false
        });
      }
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
                    pathname: `/${orgId}/${projectId}/`,
                    query: {query: tag.key + ':' + '"' + tagValue.value + '"'}
                  }}>
                <span className="tag-bar-background" style={{width: pct + '%'}}></span>
                <span className="tag-bar-label">{deviceNameMapper(tagValue.name)}</span>
                <span className="tag-bar-count"><Count value={tagValue.count} /></span>
              </Link>
            </li>
          );
        });

        return (
          <div className="col-md-6" key={tagIdx}>
            <div className="box">
              <div className="box-header">
                <span className="pull-right">
                  <Link className="btn btn-default btn-sm" to={`/${orgId}/${projectId}/issues/${groupId}/tags/${tag.key}/`}>{t('More Details')}</Link>
                </span>
                <h5>{tag.name} (<Count value={tag.uniqueValues} />)</h5>
              </div>
              <div className="box-content with-padding">
                <ul className="list-unstyled">
                  {valueChildren}
                </ul>
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
            Tags are automatically indexed for searching and breakdown charts.
            Learn how to <a href={this.getTagsDocsUrl()}>add custom tags to issues</a>.
          </div>
        </div>
      </div>
    );
  }
});

export default GroupTags;
