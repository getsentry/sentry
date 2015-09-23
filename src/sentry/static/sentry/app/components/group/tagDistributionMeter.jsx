import React from "react";
import Router from "react-router";
import ApiMixin from "../../mixins/apiMixin";
import PropTypes from "../../proptypes";
import TooltipMixin from "../../mixins/tooltip";
import {escape, percent} from "../../utils";

var TagDistributionMeter = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  propTypes: {
    group: PropTypes.Group.isRequired,
    tag: React.PropTypes.string.isRequired,
    name: React.PropTypes.string
  },

  mixins: [
    ApiMixin,
    TooltipMixin({
      html: true,
      selector: ".segment",
      container: "body"
    })
  ],

  getInitialState() {
    return {
      loading: true,
      error: false,
      data: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  fetchData() {
    var url = '/groups/' + this.props.group.id + '/tags/' + encodeURIComponent(this.props.tag) + '/';

    this.setState({
      loading: true,
      error: false
    });

    this.apiRequest(url, {
      success: (data, _, jqXHR) => {
        this.setState({
          data: data,
          error: false,
          loading: false
        });
      },
      error: () => {
        this.setState({
          error: true,
          loading: false
        });
      }
    });
  },

  /**
   * Render segments of tag distribution
   *
   * e.g.
   *
   * .--------.-----.----------------.
   * |  web-1 |web-2|     other      |
   * `--------'-----'----------------'
   */

  renderSegments() {
    let data = this.state.data;
    let totalValues = data.totalValues;

    let totalVisible = data.topValues.reduce((sum, value) => sum + value.count, 0);

    let hasOther = totalVisible < totalValues;
    let otherPct = percent(totalValues - totalVisible, totalValues);
    let otherPctLabel = Math.floor(otherPct);

    let params = {...this.context.router.getCurrentParams()};
    params.tagKey = this.props.tag;

    return (
      <div className="segments">
        {data.topValues.map((value) => {
          var pct = percent(value.count, totalValues);
          var pctLabel = Math.floor(pct);

          return (
            <Router.Link
                key={value.value}
                className="segment" style={{width: pct + "%"}}
                to="groupTagValues"
                params={params}
                title={'<div class="truncate">' + escape(value.name) + '</div>' + pctLabel + '%'}>
              <span className="tag-description">
                <span className="tag-percentage">{pctLabel}%</span>
                <span className="tag-label">{value.name}</span>
              </span>
            </Router.Link>
          );
        })}
        {hasOther &&
          <Router.Link
              key="other"
              className="segment" style={{width: otherPct + "%"}}
              to="groupTagValues"
              params={params}
              title={'Other<br/>' + otherPctLabel + '%'}>
            <span className="tag-description">
              <span className="tag-percentage">{otherPctLabel}%</span>
              <span className="tag-label">Other</span>
            </span>
          </Router.Link>
        }
      </div>
    );
  },

  renderBody() {
    if (this.state.loading || this.state.error)
      return null;

    if (!this.state.data.totalValues)
      return <p>No recent data.</p>;

    return this.renderSegments();
  },


  render() {
    return (
      <div className="distribution-graph">
        <h6><span>{this.props.name}</span></h6>
        {this.renderBody()}
      </div>
    );
  }
});

export default TagDistributionMeter;
