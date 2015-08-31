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

  render() {
    if (this.state.loading)
      return (
        <div className="distribution-graph">
          <h6><span>{this.props.name}</span></h6>
        </div>
      );

    if (this.state.error)
      return (
        <div className="distribution-graph">
          <h6><span>{this.props.name}</span></h6>
        </div>
      );

    var data = this.state.data;
    var totalValues = data.totalValues;

    if (!totalValues) {
      return (
        <div className="distribution-graph">
          <h6><span>{this.props.name}</span></h6>
          <p>No recent data.</p>
        </div>
      );
    }

    var totalVisible = 0;
    data.topValues.forEach((value) => {
      totalVisible += value.count;
    });

    var hasOther = (totalVisible < totalValues);
    var otherPct = percent(totalValues - totalVisible, totalValues);
    var otherPctLabel = Math.floor(otherPct);

    var currentParams = this.context.router.getCurrentParams();
    var params = {
      orgId: currentParams.orgId,
      projectId: currentParams.projectId,
      groupId: currentParams.groupId,
      tagKey: this.props.tag
    };

    return (
      <div className="distribution-graph">
        <h6><span>{this.props.name}</span></h6>
        <div className="segments">
          {data.topValues.map((value) => {
            var pct = percent(value.count, totalValues);
            var pctLabel = Math.floor(pct);

            return (
              <Router.Link
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
      </div>
    );
  }
});

export default TagDistributionMeter;
