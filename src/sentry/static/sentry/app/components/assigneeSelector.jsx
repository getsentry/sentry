import PropTypes from 'prop-types';
import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';
import classNames from 'classnames';
import _ from 'lodash';

import {t} from '../locale';
import {valueIsEqual, buildUserId, buildTeamId} from '../utils';
import {userDisplayName} from '../utils/formatters';
import Avatar from '../components/avatar';
import TeamAvatar from '../components/teamAvatar';
import ActorAvatar from '../components/actorAvatar';
import Tooltip from '../components/tooltip';
import ConfigStore from '../stores/configStore';
import DropdownLink from './dropdownLink';
import FlowLayout from './flowLayout';
import GroupStore from '../stores/groupStore';
import {assignToUser, assignToActor} from '../actionCreators/group';
import TeamStore from '../stores/teamStore';
import LoadingIndicator from '../components/loadingIndicator';
import MemberListStore from '../stores/memberListStore';
import MenuItem from './menuItem';

const AssigneeSelector = createReactClass({
  displayName: 'AssigneeSelector',

  propTypes: {
    id: PropTypes.string.isRequired,
  },

  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.connect(MemberListStore, 'memberList'),
  ],

  statics: {
    filterMembers(memberList, filter) {
      if (!memberList) return [];
      if (!filter) return memberList;

      filter = filter.toLowerCase();
      return memberList.filter(item => {
        let fullName = [item.name, item.email].join(' ').toLowerCase();

        return fullName.indexOf(filter) !== -1;
      });
    },

    putSessionUserFirst(members) {
      // If session user is in the filtered list of members, put them at the top
      let sessionUser = ConfigStore.get('user');
      let sessionUserIndex = members.findIndex(
        member => sessionUser && member.id === sessionUser.id
      );

      if (sessionUserIndex === -1) return members;

      return [members[sessionUserIndex]]
        .concat(members.slice(0, sessionUserIndex))
        .concat(members.slice(sessionUserIndex + 1));
    },
  },

  getInitialState() {
    let group = GroupStore.get(this.props.id);

    return {
      assignedTo: group.assignedTo,
      memberList: MemberListStore.loaded ? MemberListStore.getAll() : null,
      filter: '',
      isOpen: false,
      loading: false,
    };
  },

  componentWillReceiveProps(nextProps) {
    let loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id != this.props.id || loading != this.state.loading) {
      let group = GroupStore.get(this.props.id);
      this.setState({
        assignedTo: group.assignedTo,
        loading,
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (
      nextState.isOpen !== this.state.isOpen ||
      nextState.filter !== this.state.filter ||
      nextState.loading !== this.state.loading
    ) {
      return true;
    }

    // XXX(billyvg): this means that once `memberList` is not-null, this component will never update due to `memberList` changes
    // Note: this allows us to show a "loading" state for memberList, but only before `MemberListStore.loadInitialData`
    // is called
    if (
      this.state.memberList === null &&
      nextState.memberList !== this.state.memberList
    ) {
      return true;
    }
    return !valueIsEqual(nextState.assignedTo, this.state.assignedTo, true);
  },

  assignableTeams() {
    let group = GroupStore.get(this.props.id);
    return _.uniqBy(TeamStore.getAll(), ({id}) => id)
      .filter(({projects}) => projects.some(p => p.slug === group.project.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        name: team.slug,
        display: team.slug,
        team,
      }));
  },

  onGroupChange(itemIds) {
    if (!itemIds.has(this.props.id)) {
      return;
    }
    let group = GroupStore.get(this.props.id);
    this.setState({
      assignedTo: group && group.assignedTo,
      loading: GroupStore.hasStatus(this.props.id, 'assignTo'),
    });
  },

  assignToUser(user) {
    assignToUser({id: this.props.id, user});
    this.setState({filter: '', loading: true});
  },

  assignToTeam(team) {
    assignToActor({type: 'team', actor: {id: team.id, type: 'team'}, id: this.props.id});
    this.setState({filter: '', loading: true});
  },

  clearAssignTo() {
    //clears assignment
    assignToUser({id: this.props.id});
    this.setState({filter: '', loading: true});
  },

  onFilterKeyUp(evt) {
    if (evt.key === 'Escape') {
      this.onDropdownClose();
    } else {
      this.setState({
        filter: evt.target.value,
      });
    }
  },

  onFilterKeyDown(evt) {
    if (evt.key === 'Enter' && this.state.filter) {
      let members = AssigneeSelector.filterMembers(
        this.state.memberList,
        this.state.filter
      );
      if (members.length > 0) {
        this.assignToUser(members[0]);
      }
    }
  },

  onFilterMount(ref) {
    if (ref) {
      // focus filter input
      ref.focus();
    }
  },

  onFilterClick(e) {
    // Prevent dropdown menu from closing when filter input is clicked
    e.stopPropagation();
  },

  onDropdownOpen() {
    this.setState({isOpen: true});
  },

  onDropdownClose() {
    this.setState({
      isOpen: false,
      filter: '',
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
        <strong className="highlight">{text.substr(idx, highlightText.length)}</strong>
        {text.substr(idx + highlightText.length)}
      </span>
    );
  },

  render() {
    let {loading, assignedTo, filter, memberList} = this.state;
    let memberListLoading = this.state.memberList === null;

    let className = classNames('assignee-selector anchor-right', {
      unassigned: !assignedTo,
    });

    let members = AssigneeSelector.filterMembers(memberList, filter);
    members = AssigneeSelector.putSessionUserFirst(members);

    let memberNodes =
      members && members.length ? (
        _.uniqBy(memberList, ({id}) => id).map(item => {
          return (
            <MenuItem
              key={buildUserId(item.id)}
              disabled={loading}
              onSelect={this.assignToUser.bind(this, item)}
            >
              <Avatar user={item} className="avatar" size={48} />
              {this.highlight(item.name || item.email, filter)}
            </MenuItem>
          );
        })
      ) : (
        <li className="not-found">
          <span>{t('No matching users found.')}</span>
        </li>
      );

    // Outer div is needed to make tooltip work
    let teamNodes = AssigneeSelector.filterMembers(
      this.assignableTeams(),
      filter
    ).map(({id, display, team}) => {
      return (
        <MenuItem
          key={id}
          disabled={loading}
          onSelect={this.assignToTeam.bind(this, team)}
        >
          <TeamAvatar team={team} className="avatar" size={48} />
          {this.highlight(display, filter)}
        </MenuItem>
      );
    });
    if (teamNodes.length > 0) {
      teamNodes = [...teamNodes, <hr key="divider" style={{margin: 0}} />];
    }

    let assignedUser = assignedTo && MemberListStore.getById(assignedTo.id);
    let tooltipTitle = assignedUser ? userDisplayName(assignedUser) : null;

    return (
      <div>
        <Tooltip title={tooltipTitle} disabled={!tooltipTitle}>
          <div className={className}>
            {loading ? (
              <LoadingIndicator mini />
            ) : (
              <DropdownLink
                className="assignee-selector-toggle"
                onOpen={this.onDropdownOpen}
                onClose={this.onDropdownClose}
                isOpen={this.state.isOpen}
                alwaysRenderMenu={false}
                title={
                  assignedTo ? (
                    <ActorAvatar actor={assignedTo} className="avatar" size={48} />
                  ) : (
                    <span className="icon-user" />
                  )
                }
              >
                {!memberListLoading && (
                  <MenuItem noAnchor>
                    <input
                      type="text"
                      className="form-control input-sm"
                      placeholder={t('Filter teams and people')}
                      ref={ref => this.onFilterMount(ref)}
                      onClick={this.onFilterClick}
                      onKeyDown={this.onFilterKeyDown}
                      onKeyUp={this.onFilterKeyUp}
                    />
                  </MenuItem>
                )}
                {!memberListLoading &&
                  assignedTo && (
                    <MenuItem
                      className="clear-assignee"
                      disabled={!loading}
                      onSelect={this.clearAssignTo}
                    >
                      <span className="icon-circle-cross" /> {t('Clear Assignee')}
                    </MenuItem>
                  )}
                {!memberListLoading && (
                  <li>
                    <ul>{[...teamNodes, ...memberNodes]}</ul>
                  </li>
                )}

                {memberListLoading && (
                  <li>
                    <FlowLayout center className="list-loading-container">
                      <LoadingIndicator mini />
                    </FlowLayout>
                  </li>
                )}
              </DropdownLink>
            )}
          </div>
        </Tooltip>
      </div>
    );
  },
});

export default AssigneeSelector;
