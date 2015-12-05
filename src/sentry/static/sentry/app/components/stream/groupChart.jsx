import LazyLoad from 'react-lazy-load';
import React from 'react';
import Reflux from 'reflux';

import BarChart from '../barChart';
import GroupStore from '../../stores/groupStore';
import {valueIsEqual} from '../../utils';

const GroupChart = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired,
    statsPeriod: React.PropTypes.string.isRequired,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange')
  ],

  getInitialState() {
    let data = GroupStore.get(this.props.id);
    return {
      stats: data ? data.stats[this.props.statsPeriod] : null
    };
  },

  componentWillReceiveProps(nextProps) {
    if (!valueIsEqual(nextProps, this.props)) {
      let data = GroupStore.get(this.props.id);
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

    let id = this.props.id;
    let data = GroupStore.get(id);

    this.setState({
      stats: data.stats[this.props.statsPeriod],
    });
  },

  render() {
    if (!this.state.stats || !this.state.stats.length)
      return null;

    let chartData = this.state.stats.map((point) => {
      return {x: point[0], y: point[1]};
    });

    return (
      <LazyLoad>
        <BarChart points={chartData} className="sparkline" />
      </LazyLoad>
    );
  }
});

export default GroupChart;
