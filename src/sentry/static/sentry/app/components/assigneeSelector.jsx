import React from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import classNames from 'classnames';
import api from '../api';
import Gravatar from '../components/gravatar';
import GroupStore from '../stores/groupStore';
import DropdownLink from './dropdownLink';
import MemberListStore from '../stores/memberListStore';
import MenuItem from './menuItem';
import LoadingIndicator from '../components/loadingIndicator';
import {userDisplayName} from '../utils/formatters';
import {valueIsEqual} from '../utils';
import TooltipMixin from '../mixins/tooltip';

const AssigneeSelector = React.createClass({
  propTypes: {
    id: React.PropTypes.string.isRequired
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    TooltipMixin({
      html: true,
      selector: '.tip'
    })
  ],

  getInitialState() {
    let group = GroupStore.get(this.props.id);

    return {
      assignedTo: group.assignedTo,
      memberList: MemberListStore.getAll(),
      filter: '',
      loading: false
    };
  },

  componentWillReceiveProps(nextProps) {
    let loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id != this.props.id || loading != this.state.loading) {
      let group = GroupStore.get(this.props.id);
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

  componentDidUpdate(prevProps, prevState) {
    // XXX(dcramer): fix odd dedraw issue as of Chrome 45.0.2454.15 dev (64-bit)
    let node = jQuery(ReactDOM.findDOMNode(this.refs.container));
    node.hide().show(0);
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let group = GroupStore.get(this.props.id);
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

  onFilterChange(evt) {
    this.setState({
      filter: evt.target.value
    });
  },

  onDropdownOpen() {
    ReactDOM.findDOMNode(this.refs.filter).focus();
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
    let idx = text.toLowerCase().indexOf(highlightText);
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

  render() {
    let loading = this.state.loading;
    let assignedTo = this.state.assignedTo;
    let filter = this.state.filter;

    let className = 'assignee-selector anchor-right';
    if (!assignedTo) {
      className += ' unassigned';
    }

    let memberNodes = [];
    this.state.memberList.forEach(function(item){
      let fullName = [item.name, item.email].join(' ').toLowerCase();
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

    let tooltipTitle = null;
    if (assignedTo) {
      tooltipTitle = userDisplayName(assignedTo);
    }

    return (
      <div ref="container">
        <div className={classNames(className, 'tip')} title={tooltipTitle} >
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
