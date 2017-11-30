import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import SelectedGroupStore from '../../stores/selectedGroupStore';
import Checkbox from '../checkbox';

const GroupCheckBox = createReactClass({
  displayName: 'GroupCheckBox',

  propTypes: {
    id: PropTypes.string.isRequired,
  },

  mixins: [Reflux.listenTo(SelectedGroupStore, 'onSelectedGroupChange')],

  getInitialState() {
    return {
      isSelected: SelectedGroupStore.isSelected(this.props.id),
    };
  },

  componentWillReceiveProps(nextProps) {
    if (nextProps.id != this.props.id) {
      this.setState({
        isSelected: SelectedGroupStore.isSelected(nextProps.id),
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    return nextState.isSelected !== this.state.isSelected;
  },

  onSelectedGroupChange() {
    let isSelected = SelectedGroupStore.isSelected(this.props.id);
    if (isSelected !== this.state.isSelected) {
      this.setState({
        isSelected,
      });
    }
  },

  onSelect() {
    let id = this.props.id;
    SelectedGroupStore.toggleSelect(id);
  },

  render() {
    return (
      <Checkbox
        value={this.props.id}
        checked={this.state.isSelected}
        onChange={this.onSelect}
      />
    );
  },
});

export default GroupCheckBox;
