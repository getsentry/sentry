import React from "react";
import {Link} from "react-router";
import ApiMixin from "../mixins/apiMixin";
import Count from "../components/count";
import GroupState from "../mixins/groupState";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import {percent} from "../utils";

var GroupTags = React.createClass({
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
    this.apiRequest('/groups/' + this.getGroup().id + '/tags/', {
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

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var children = [];

    var orgId = this.getOrganization().slug;
    var projectId = this.getProject().slug;
    var groupId = this.getGroup().id;

    if (this.state.tagList) {
      children = this.state.tagList.map((tag, tagIdx) => {
        var valueChildren = tag.topValues.map((tagValue, tagValueIdx) => {
          var pct = percent(tagValue.count, tag.totalValues);
          return (
            <li key={tagValueIdx}>
              <Link
                  className="tag-bar"
                  to={`/${orgId}/${projectId}/`}
                  query={{query: tag.key + ':' + '"' + tagValue.value + '"'}}>
                <span className="tag-bar-background" style={{width: pct + '%'}}></span>
                <span className="tag-bar-label">{tagValue.name}</span>
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
                  <Link to={`/${orgId}/${projectId}/group/${groupId}/tags/${tag.key}/`}>More Details</Link>
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
      </div>
    );
  }
});

export default GroupTags;
