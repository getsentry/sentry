import React from "react";
import Reflux from "reflux";
import BarChart from "../barChart";
import GroupStore from "../../stores/groupStore";
import {valueIsEqual} from "../../utils";

var GroupChart = React.createClass({
  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  propTypes: {
    id: React.PropTypes.string.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
  },

  getInitialState() {
    var data = GroupStore.get(this.props.id);
    return {
      stats: data ? data.stats[this.props.statsPeriod] : null
    };
  },

  componentWillReceiveProps(nextProps) {
    if (!valueIsEqual(nextProps, this.props)) {
      var data = GroupStore.get(this.props.id);
      this.setState({
        stats: data.stats[this.props.statsPeriod]
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (!valueIsEqual(this.props, nextProps, true)) {
      return true;
    }
    if (!valueIsEqual(this.state.stats, nextState.stats, true)) {
      return true;
    }
    return false;
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }

    var id = this.props.id;
    var data = GroupStore.get(id);

    this.setState({
      stats: data.stats[this.props.statsPeriod],
    });
  },

  render() {
    if (!this.state.stats)
      return null;

    var chartData = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <BarChart points={chartData} className="sparkline" />
    );
  }
});

export default GroupChart;
