import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {StyledMenu} from 'app/components/dropdownAutoCompleteMenu';
import {assignToUser, assignToActor, clearAssignment} from 'app/actionCreators/group';
import {t} from 'app/locale';
import {valueIsEqual, buildUserId, buildTeamId} from 'app/utils';
import ActorAvatar from 'app/components/actorAvatar';
import Avatar from 'app/components/avatar';
import ConfigStore from 'app/stores/configStore';
import DropdownAutoComplete from 'app/components/dropdownAutoComplete';
import Feature from 'app/components/feature';
import GroupStore from 'app/stores/groupStore';
import Highlight from 'app/components/highlight';
import InlineSvg from 'app/components/inlineSvg';
import Link from 'app/components/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

const AssigneeSelectorComponent = createReactClass({
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
    putSessionUserFirst(members) {
      // If session user is in the filtered list of members, put them at the top
      if (!members) return [];

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
    let memberList = MemberListStore.loaded ? MemberListStore.getAll() : null;
    let loading = GroupStore.hasStatus(this.props.id, 'assignTo');

    return {
      assignedTo: group && group.assignedTo,
      memberList,
      loading,
    };
  },

  componentWillReceiveProps(nextProps) {
    let loading = GroupStore.hasStatus(nextProps.id, 'assignTo');
    if (nextProps.id !== this.props.id || loading !== this.state.loading) {
      let group = GroupStore.get(this.props.id);
      this.setState({
        loading,
        assignedTo: group && group.assignedTo,
      });
    }
  },

  shouldComponentUpdate(nextProps, nextState) {
    if (nextState.loading !== this.state.loading) {
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

    return (ProjectsStore.getBySlug(group.project.slug) || {
      teams: [],
    }).teams
      .sort((a, b) => a.slug.localeCompare(b.slug))
      .map(team => ({
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
    this.setState({loading: true});
  },

  assignToTeam(team) {
    assignToActor({actor: {id: team.id, type: 'team'}, id: this.props.id});
    this.setState({loading: true});
  },

  handleAssign({value: {type, assignee}}, state, e) {
    if (type === 'member') {
      this.assignToUser(assignee);
    }

    if (type === 'team') {
      this.assignToTeam(assignee);
    }

    e.stopPropagation();
  },

  clearAssignTo(e) {
    // clears assignment
    clearAssignment(this.props.id);
    this.setState({loading: true});
    e.stopPropagation();
  },

  renderNewMemberNodes() {
    let {memberList} = this.state;
    let {size} = this.props;
    let members = AssigneeSelectorComponent.putSessionUserFirst(memberList);

    return members.map(member => {
      return {
        value: {type: 'member', assignee: member},
        searchKey: `${member.email} ${member.name} ${member.slug}`,
        label: ({inputValue}) => (
          <MenuItemWrapper
            key={buildUserId(member.id)}
            onSelect={this.assignToUser.bind(this, member)}
          >
            <IconContainer>
              <Avatar user={member} size={size} />
            </IconContainer>
            <Label>
              <Highlight text={inputValue}>{member.name || member.email}</Highlight>
            </Label>
          </MenuItemWrapper>
        ),
      };
    });
  },

  renderNewTeamNodes() {
    let {size} = this.props;

    return this.assignableTeams().map(({id, display, team}) => {
      return {
        value: {type: 'team', assignee: team},
        searchKey: team.slug,
        label: ({inputValue}) => (
          <MenuItemWrapper key={id} onSelect={this.assignToTeam.bind(this, team)}>
            <IconContainer>
              <Avatar team={team} size={size} />
            </IconContainer>
            <Label>
              <Highlight text={inputValue}>{display}</Highlight>
            </Label>
          </MenuItemWrapper>
        ),
      };
    });
  },

  renderNewDropdownItems() {
    let teams = this.renderNewTeamNodes();
    let members = this.renderNewMemberNodes();

    return [
      {id: 'team-header', hideGroupLabel: true, items: teams},
      {id: 'members-header', items: members},
    ];
  },

  render() {
    let {className} = this.props;
    let {loading, assignedTo, memberList} = this.state;
    let canInvite = ConfigStore.get('invitesEnabled');

    return (
      <div className={className}>
        {loading && (
          <LoadingIndicator mini style={{height: '24px', margin: 0, marginRight: 11}} />
        )}
        {!loading && (
          <DropdownAutoComplete
            maxHeight={400}
            zIndex={2}
            onOpen={e => {
              // This can be called multiple times and does not always have `event`
              if (!e) return;
              e.stopPropagation();
            }}
            busy={memberList === null}
            items={memberList !== null ? this.renderNewDropdownItems() : []}
            alignMenu="right"
            onSelect={this.handleAssign}
            itemPadding={`5px ${space(1)}`}
            searchPadding={`${space(1)}`}
            searchPlaceholder={t('Filter teams and people')}
            menuWithArrow
            menuHeader={
              assignedTo && (
                <ClearAssignee
                  data-test-id="clear-assignee"
                  disabled={!loading}
                  onClick={this.clearAssignTo}
                  py={0}
                >
                  <IconContainer>
                    <ClearAssigneeIcon />
                  </IconContainer>
                  <Label>{t('Clear Assignee')}</Label>
                </ClearAssignee>
              )
            }
            menuFooter={
              canInvite && (
                <Feature access={['org:write']}>
                  <InviteMemberLink
                    data-test-id="invite-member"
                    disabled={loading}
                    to={`/settings/${this.context.organization
                      .slug}/members/new/?referrer=assignee_selector`}
                  >
                    <MenuItemWrapper>
                      <IconContainer>
                        <InviteMemberIcon />
                      </IconContainer>
                      <Label>{t('Invite Member')}</Label>
                    </MenuItemWrapper>
                  </InviteMemberLink>
                </Feature>
              )
            }
          >
            {({getActorProps}) => {
              return (
                <DropdownButton {...getActorProps({})}>
                  {assignedTo ? (
                    <ActorAvatar actor={assignedTo} className="avatar" size={24} />
                  ) : (
                    <IconUser src="icon-user" />
                  )}
                  <StyledChevron src="icon-chevron-down" />
                </DropdownButton>
              );
            }}
          </DropdownAutoComplete>
        )}
      </div>
    );
  },
});

const AssigneeSelector = styled(AssigneeSelectorComponent)`
  display: flex;
  justify-content: flex-end;

  /* manually align menu underneath dropdown caret */
  /* stylelint-disable-next-line no-duplicate-selectors */
  ${StyledMenu} {
    right: -14px;
  }
`;

export default AssigneeSelector;
export {AssigneeSelectorComponent};

const getSvgStyle = () => `
  font-size: 16px;
  opacity: 0.3;
`;

const IconUser = styled(InlineSvg)`
  color: ${p => p.theme.gray3};
  height: 24px;
  width: 24px;
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
  cursor: pointer;
  display: flex;
  align-items: center;
  font-size: 13px;
  ${props =>
    typeof props.py !== 'undefined' &&
    `
      padding-top: ${props.py};
      padding-bottom: ${props.py};
    `};
`;

const ClearAssignee = styled(MenuItemWrapper)`
  background: rgba(52, 60, 69, 0.03);
  border-bottom: 1px solid rgba(52, 60, 69, 0.06);
`;

const InviteMemberLink = styled(Link)`
  color: ${p => p.theme.textColor};
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

const StyledChevron = styled(InlineSvg)`
  margin-left: ${space(1)};
  width: 12px;
  height: 12px;
`;

const DropdownButton = styled('div')`
  display: flex;
  align-items: center;
  font-size: 20px;
`;
