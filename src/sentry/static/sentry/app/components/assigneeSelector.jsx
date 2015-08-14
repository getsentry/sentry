import React from "react";
import Reflux from "reflux";
import api from "../api";
import Gravatar from "../components/gravatar";
import GroupStore from "../stores/groupStore";
import DropdownLink from "./dropdownLink";
import MemberListStore from "../stores/memberListStore";
import MenuItem from "./menuItem";
import PropTypes from "../proptypes";
import LoadingIndicator from "../components/loadingIndicator";
import {compareArrays, valueIsEqual} from "../utils";

var AssigneeSelector = React.createClass({
  mixins: [
    Reflux.listenTo(GroupStore, "onGroupChange")
  ],

  propTypes: {
    id: React.PropTypes.string.isRequired
  },

  getInitialState() {
    var group = GroupStore.get(this.props.id);

    return {
      assignedTo: group.assignedTo,
      memberList: MemberListStore.getAll(),
      filter: '',
      loading: false
    };
  },

  componentWillReceiveProps(nextProps) {
    var loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id != this.props.id || loading != this.state.loading) {
      var group = GroupStore.get(this.props.id);
      this.setState({
        assignedTo: group.assignedTo,
        memberList: MemberListStore.getAll(),
        loading: loading
      });
    }
  },

  // TODO(dcramer): this should check changes in member list
  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.filter !== this.state.filter) {
      return true;
    }
    if (nextState.loading !== this.state.loading) {
      return true;
    }
    return valueIsEqual(nextState.assignedTo, this.state.assignedTo, true);
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    var group = GroupStore.get(this.props.id);
    this.setState({
      assignedTo: group.assignedTo,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo')
    });
  },

  assignTo(member) {
    api.assignTo({id: this.props.id, email: member.email});
    this.setState({filter: '', loading: true});
  },

  clearAssignTo() {
    api.assignTo({id: this.props.id, email: ''});
    this.setState({filter: '', loading: true});
  },

  onFilterChange(event) {
    this.setState({
      filter: event.target.value
    });
  },

  onDropdownOpen() {
    this.refs.filter.getDOMNode().focus();
  },

  onDropdownClose() {
    this.setState({
      filter: ''
    });
  },

  highlight(text, highlightText) {
    if (!highlightText) {
      return text;
    }
    highlightText = highlightText.toLowerCase();
    var idx = text.toLowerCase().indexOf(highlightText);
    if (idx === -1) {
      return text;
    }
    return (
      <span>
        {text.substr(0, idx)}
        <strong className="highlight">
          {text.substr(idx, highlightText.length)}
        </strong>
        {text.substr(idx + highlightText.length)}
      </span>
    );
  },

  componentDidUpdate(prevProps, prevState) {
    // XXX(dcramer): fix odd dedraw issue as of Chrome 45.0.2454.15 dev (64-bit)
    var node = jQuery(this.refs.container.getDOMNode());
    node.hide().show(0);
  },

  render() {
    var loading = this.state.loading;
    var assignedTo = this.state.assignedTo;
    var filter = this.state.filter;

    var className = "assignee-selector anchor-right";
    if (!assignedTo) {
      className += " unassigned";
    }

    var memberNodes = [];
    this.state.memberList.forEach(function(item){
      var fullName = [item.name, item.email].join(' ').toLowerCase();
      if (filter && fullName.indexOf(filter) === -1) {
        return;
      }
      memberNodes.push(
        <MenuItem key={item.id}
                  disabled={!loading}
                  onSelect={this.assignTo.bind(this, item)} >
          <Gravatar email={item.email} className="avatar"
                    size={48} />
          {this.highlight(item.name || item.email, this.state.filter)}
        </MenuItem>
      );
    }.bind(this));

    return (
      <div ref="container">
        <div className={className}>
          {loading ?
            <LoadingIndicator mini={true} />
          :
            <DropdownLink
              className="assignee-selector-toggle"
              onOpen={this.onDropdownOpen}
              onClose={this.onDropdownClose}
              title={assignedTo ?
                <Gravatar email={assignedTo.email} className="avatar"
                          size={48} />
                :
                <span className="icon-user" />
              }>
              <MenuItem noAnchor={true} key="filter">
                <input type="text" className="form-control input-sm"
                       placeholder="Filter people" ref="filter"
                       onKeyUp={this.onFilterChange} />
              </MenuItem>
              {assignedTo ?
                <MenuItem key="clear"
                          className="clear-assignee"
                          disabled={!loading}
                          onSelect={this.clearAssignTo}>
                  <span className="icon-circle-cross"/> Clear Assignee
                </MenuItem>
              : ''}
              {memberNodes}
            </DropdownLink>
          }
        </div>
      </div>
    );
  }
});

export default AssigneeSelector;
