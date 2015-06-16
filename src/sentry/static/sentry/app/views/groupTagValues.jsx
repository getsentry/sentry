var $ = require("jquery");
var React = require("react");

var api = require("../api");
var Count = require("../components/count");
var GroupState = require("../mixins/groupState");
var LoadingError = require("../components/loadingError");
var LoadingIndicator = require("../components/loadingIndicator");
var Pagination = require("../components/pagination");
var PropTypes = require("../proptypes");

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
    var querystring = $.param(queryParams);

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

    var tagKey = this.state.tagKey;
    var children = this.state.tagValueList.map((tagValue, tagValueIdx) => {
      var pct = parseInt(tagValue.count / tagKey.totalValues * 100, 10);
      return (
        <li key={tagValueIdx}>
          <a className="tag-bar" href="">
            <span className="tag-bar-background" style={{width: pct + '%'}}></span>
            <span className="tag-bar-label">{tagValue.value}</span>
            <span className="tag-bar-count"><Count value={tagValue.count} /></span>
          </a>
        </li>
      );
    });

    return (
      <div>
        <div className="box">
          <div className="box-header">
            <span className="pull-right">
              <a href="">More Details</a>
            </span>
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

module.exports = GroupTagValues;
