import PropTypes from 'prop-types';
import React from 'react';
// import styled from 'react-emotion';
import {MentionsInput, Mention} from 'react-mentions';
import mentionsStyle from '../../../../styles/mentions-styles';

// import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {t, tct} from '../../../locale';

class ProjectOwnership extends React.Component {
  static propTypes = {
    organization: PropTypes.object,
    project: PropTypes.object,
  };

  getTitle() {
    return 'Ownership';
  }

  mentionableUsers() {
    let {memberList, sessionUser} = this.props;
    return _.uniqBy(memberList, ({id}) => id)
      .filter(member => sessionUser.id !== member.id)
      .map(member => ({
        id: buildUserId(member.id),
        display: member.name,
        email: member.email,
      }));
  },
  mentionableTeams() {
    let {group} = this.props;

    return _.uniqBy(TeamStore.getAll(), ({id}) => id)
      .filter(({projects}) => !!projects.find(p => p.slug === group.project.slug))
      .map(team => ({
        id: buildTeamId(team.id),
        display: team.slug,
        email: team.id,
      }));
  },


  renderBody() {
    let {organization, project} = this.props;

    return (
      <React.Fragment>
        <MentionsInput
          style={mentionsStyle}
          placeholder={'...'}
          onChange={this.onChange}
          onBlur={this.onBlur}
          onKeyDown={this.onKeyDown}
          value={'value'}
          required={true}
          autoFocus={true}
          displayTransform={(id, display, type) =>
            `${type === 'member' ? '@' : '#'}${display}`}
          markup="**[sentry.strip:__type__]__display__**"
        >
          <Mention
            type="member"
            trigger="@"
            data={mentionableUsers}
            onAdd={this.onAddMember}
            appendSpaceOnAdd={true}
          />
          <Mention
            type="team"
            trigger="#"
            data={mentionableTeams}
            onAdd={this.onAddTeam}
            appendSpaceOnAdd={true}
          />
        </MentionsInput>
      </React.Fragment>
    );
  }
}

export default ProjectOwnership;
