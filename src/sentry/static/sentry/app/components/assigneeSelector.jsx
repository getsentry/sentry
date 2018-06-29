import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import classNames from 'classnames';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {assignToUser, assignToActor, clearAssignment} from 'app/actionCreators/group';
import {t} from 'app/locale';
import {valueIsEqual, buildUserId, buildTeamId} from 'app/utils';
import ActorAvatar from 'app/components/actorAvatar';
import Avatar from 'app/components/avatar';
import ConfigStore from 'app/stores/configStore';
import DropdownLink from 'app/components/dropdownLink';
import FlowLayout from 'app/components/flowLayout';
import GroupStore from 'app/stores/groupStore';
import InlineSvg from 'app/components/inlineSvg';
import LoadingIndicator from 'app/components/loadingIndicator';
import MemberListStore from 'app/stores/memberListStore';
import MenuItem from 'app/components/menuItem';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/proptypes';
import TextOverflow from 'app/components/textOverflow';

const AssigneeSelector = createReactClass({
  displayName: 'AssigneeSelector',

  propTypes: {
    id: PropTypes.string.isRequired,
    size: PropTypes.number,
  },

  contextTypes: {
    organization: SentryTypes.Organization,
  },
  mixins: [
    Reflux.listenTo(GroupStore, 'onGroupChange'),
    Reflux.connect(MemberListStore, 'memberList'),
  ],

  statics: {
    filterAssignees(itemList, filter) {
      if (!itemList) return [];
      if (!filter) return itemList;

      filter = filter.toLowerCase();

      return itemList.filter(item => {
        let fullName = [item.name, item.email, item.slug].join(' ').toLowerCase();

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

  getDefaultProps() {
    return {
      size: 20,
    };
  },

  getInitialState() {
    let group = GroupStore.get(this.props.id);
    return {
      assignedTo: group && group.assignedTo,
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
        loading,
        assignedTo: group && group.assignedTo,
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

    return AssigneeSelector.filterAssignees(
      (ProjectsStore.getBySlug(group.project.slug) || {
        teams: [],
      }).teams.sort((a, b) => a.slug.localeCompare(b.slug)),
      this.state.filter
    ).map(team => ({
      id: buildTeamId(team.id),
      display: `#${team.slug}`,
      email: team.id,
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
    assignToActor({actor: {id: team.id, type: 'team'}, id: this.props.id});
    this.setState({filter: '', loading: true});
  },

  clearAssignTo() {
    //clears assignment
    clearAssignment(this.props.id);
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
      let members = AssigneeSelector.filterAssignees(
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
      <React.Fragment>
        {text.substr(0, idx)}
        <strong className="highlight">{text.substr(idx, highlightText.length)}</strong>
        {text.substr(idx + highlightText.length)}
      </React.Fragment>
    );
  },

  renderMemberNodes() {
    let {filter, memberList} = this.state;
    let {size} = this.props;
    let members = AssigneeSelector.filterAssignees(memberList, filter);
    members = AssigneeSelector.putSessionUserFirst(members);

    return members.map(item => {
      return (
        <MenuItem
          key={buildUserId(item.id)}
          onSelect={this.assignToUser.bind(this, item)}
        >
          <MenuItemWrapper>
            <IconContainer>
              <Avatar user={item} size={size} />
            </IconContainer>
            <Label>{this.highlight(item.name || item.email, filter)}</Label>
          </MenuItemWrapper>
        </MenuItem>
      );
    });
  },

  renderTeamNodes() {
    let {filter} = this.state;
    let {size} = this.props;

    return this.assignableTeams().map(({id, display, team}) => {
      return (
        <MenuItem key={id} onSelect={this.assignToTeam.bind(this, team)}>
          <MenuItemWrapper>
            <IconContainer>
              <Avatar team={team} size={size} />
            </IconContainer>
            <Label>{this.highlight(display, filter)}</Label>
          </MenuItemWrapper>
        </MenuItem>
      );
    });
  },

  renderDropdownItems() {
    let {loading, assignedTo} = this.state;
    let teams = this.renderTeamNodes();
    let members = this.renderMemberNodes();
    let hasTeamsAndMembers = teams.length && members.length;
    let hasTeamsOrMembers = teams.length || members.length;

    return (
      <React.Fragment>
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

        {assignedTo && (
          <MenuItem
            className="clear-assignee"
            disabled={!loading}
            onSelect={this.clearAssignTo}
          >
            <MenuItemWrapper py={0}>
              <IconContainer>
                <ClearAssigneeIcon />
              </IconContainer>
              <Label>{t('Clear Assignee')}</Label>
            </MenuItemWrapper>
          </MenuItem>
        )}

        <li>
          <ul>
            {teams}
            {hasTeamsAndMembers ? <Divider key="divider" /> : null}
            {members}
            {!hasTeamsOrMembers && (
              <li className="not-found">
                <span>{t('No matches found.')}</span>
              </li>
            )}
          </ul>
        </li>
      </React.Fragment>
    );
  },

  render() {
    let {loading, assignedTo} = this.state;
    let group = GroupStore.get(this.props.id);

    let org = this.context.organization;
    let access = new Set(org.access);

    let assigneeListLoading = this.state.memberList === null || !group;

    if (loading) {
      return (
        <div>
          <div className="assignee-selector anchor-right">
            <LoadingIndicator mini style={{marginRight: '10px'}} />
          </div>
        </div>
      );
    }

    let className = classNames('assignee-selector anchor-right', {
      unassigned: !assignedTo,
    });

    return (
      <div className={className}>
        <DropdownLink
          className="assignee-selector-toggle"
          onOpen={this.onDropdownOpen}
          onClose={this.onDropdownClose}
          isOpen={this.state.isOpen}
          alwaysRenderMenu={false}
          title={
            assignedTo ? (
              <ActorAvatar actor={assignedTo} className="avatar" size={24} />
            ) : (
              <span className="icon-user" />
            )
          }
        >
          {assigneeListLoading ? (
            <li>
              <FlowLayout center className="list-loading-container">
                <LoadingIndicator mini />
              </FlowLayout>
            </li>
          ) : (
            this.renderDropdownItems()
          )}
          {ConfigStore.get('invitesEnabled') &&
            access.has('org:write') && (
              <React.Fragment>
                <Divider />
                <MenuItem
                  className="invite-member"
                  disabled={!loading}
                  to={`/settings/${this.context.organization.slug}/members/new/`}
                  query={{referrer: 'assignee_selector'}}
                >
                  <MenuItemWrapper>
                    <IconContainer>
                      <InviteMemberIcon />
                    </IconContainer>
                    <Label>{t('Invite Member')}</Label>
                  </MenuItemWrapper>
                </MenuItem>
              </React.Fragment>
            )}
        </DropdownLink>
      </div>
    );
  },
});

export default AssigneeSelector;

const getSvgStyle = () => `
  font-size: 16px;
  opacity: 0.3;
`;

const Divider = styled.hr`
  margin: 0;
`;

const IconContainer = styled.div`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  flex-shrink: 0;
`;

const MenuItemWrapper = styled(({py, ...props}) => <div {...props} />)`
  display: flex;
  align-items: center;
  padding: 5px 8px;
  ${p =>
    typeof p.py !== 'undefined' &&
    `
      padding-top: ${p.py};
      padding-bottom: ${p.py};
    `};
`;

const Label = styled(TextOverflow)`
  margin-left: 6px;
`;

const ClearAssigneeIcon = styled(props => (
  <InlineSvg {...props} src="icon-circle-close" />
))`
  ${getSvgStyle};
`;

const InviteMemberIcon = styled(props => <InlineSvg {...props} src="icon-circle-add" />)`
  ${getSvgStyle};
`;
