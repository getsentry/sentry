import jQuery from "jquery";
import React from "react";
import api from "../api";
import Count from "../components/count";
import GroupState from "../mixins/groupState";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import Pagination from "../components/pagination";
import PropTypes from "../proptypes";

var GroupTagValues = React.createClass({
  mixins: [GroupState],

  contextTypes: {
    router: React.PropTypes.func
  },

  getInitialState() {
    return {
      tagKey: null,
      tagValueList: null,
      loading: true,
      error: false,
      pageLinks: ''
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    var queryParams = router.getCurrentQuery();
    var querystring = jQuery.param(queryParams);

    this.setState({
      loading: true,
      error: false
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + params.tagKey + '/', {
      success: (data) => {
        this.setState({
          tagKey: data,
          loading: this.state.tagValueList === null
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });

    api.request('/groups/' + this.getGroup().id + '/tags/' + params.tagKey + '/values/?' + querystring, {
      success: (data, _, jqXHR) => {
        this.setState({
          tagValueList: data,
          loading: this.state.tagKey === null,
          pageLinks: jqXHR.getResponseHeader('Link')
        });
      },
      error: (error) => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  onPage(cursor) {
    var router = this.context.router;
    var queryParams = router.getCurrentQuery();
    queryParams.cursor = cursor;

    router.transitionTo('groupTagValues', router.getCurrentParams(), queryParams);
  },

  render() {
    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    var router = this.context.router;
    var tagKey = this.state.tagKey;
    var children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      var pct = parseInt(tagValue.count / tagKey.totalValues * 100, 10);
      var params = router.getCurrentParams();
      return (
        <li key={tagValueIdx}>
          <Router.Link
              className="tag-bar"
              to="stream"
              params={params}
              query={{query: tagKey.key + ':' + '"' + tagValue.value + '"'}}>
            <span className="tag-bar-background" style={{width: pct + '%'}}></span>
            <span className="tag-bar-label">{tagValue.name}</span>
            <span className="tag-bar-count"><Count value={tagValue.count} /></span>
          </Router.Link>
        </li>
      );
    });

    return (
      <div>
        <div className="box">
          <div className="box-header">
            <h3>{tagKey.name} (<Count value={tagKey.totalValues} />)</h3>
          </div>
          <div className="box-content with-padding">
            <ul className="list-unstyled">
              {children}
            </ul>
          </div>
        </div>
        <Pagination pageLinks={this.state.pageLinks} onPage={this.onPage} />
      </div>
    );
  }
});

export default GroupTagValues;

