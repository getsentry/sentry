import PropTypes from 'prop-types';
import React from 'react';
// import styled from 'react-emotion';
import {MentionsInput, Mention} from 'react-mentions';

import {Client} from '../../../api';
import memberListStore from '../../../stores/memberListStore';
import TeamStore from '../../../stores/teamStore';
import Button from '../../../components/buttons/button';
import SentryTypes from '../../../proptypes';

import {addErrorMessage, addSuccessMessage} from '../../../actionCreators/indicator';
import {t} from '../../../locale';

let styles;
class ProjectOwnership extends React.Component {
  static propTypes = {
    organization: SentryTypes.Organization,
    project: SentryTypes.Project,
    initialText: PropTypes.string,
  };

  constructor(props) {
    super(props);
    this.state = {
      text: props.initialText,
      error: null,
    };
  }

  getTitle() {
    return 'Ownership';
  }

  updateOwnership(data) {
    let {organization, project} = this.props;
    this.setState({error: null});

    const api = new Client();
    let request = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      {
        method: 'PUT',
        data,
      }
    );

    request
      .then(() => {
        addSuccessMessage('Updated Ownership Rules');
      })
      .catch(error => {
        this.setState({error: error.responseJSON});
        addErrorMessage('Error Updating Ownership Rules');
      });

    return request;
  }

  mentionableUsers() {
    return memberListStore.getAll().map(member => ({
      id: member.id,
      display: member.name,
      email: member.email,
    }));
  }

  mentionableTeams() {
    let {project} = this.props;
    return TeamStore.getAll()
      .filter(({projects}) => !!projects.find(p => p.slug === project.slug))
      .map(team => ({
        id: team.id,
        display: team.slug,
        email: team.id,
      }));
  }
  onChange(v) {
    this.setState({text: v.target.value});
  }
  render() {
    let {text, error} = this.state;
    let mentionableUsers = this.mentionableUsers();
    let mentionableTeams = this.mentionableTeams();

    return (
      <React.Fragment>
        <MentionsInput
          style={styles}
          placeholder={'Project Ownership'}
          onChange={this.onChange.bind(this)}
          onBlur={this.onBlur}
          onKeyDown={this.onKeyDown}
          value={text}
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
        {error && error.raw.toString()}
        <Button
          size="small"
          priority="primary"
          onClick={() => {
            this.updateOwnership({raw: this.state.text});
          }}
        >
          {t('Save Changes')}
        </Button>
      </React.Fragment>
    );
  }
}
styles = {
  control: {
    backgroundColor: '#fff',
    fontSize: 15,
    fontWeight: 'normal',
  },

  input: {
    margin: 0,
    fontFamily: 'Rubik, sans-serif',
    wordBreak: 'break-all',
    whiteSpace: 'pre-wrap',
  },

  '&singleLine': {
    control: {
      display: 'inline-block',

      width: 130,
    },

    highlighter: {
      padding: 1,
      border: '2px inset transparent',
    },

    input: {
      padding: 1,
      border: '2px inset',
    },
  },

  '&multiLine': {
    control: {
      fontFamily: 'Lato, Avenir Next, Helvetica Neue, sans-serif',
    },

    highlighter: {
      padding: 20,
    },

    input: {
      padding: '15px 20px 0',
      minHeight: 140,
      overflow: 'auto',
      outline: 0,
      border: '1 solid',
    },
  },

  suggestions: {
    list: {
      maxHeight: 150,
      overflow: 'auto',
      backgroundColor: 'white',
      border: '1px solid rgba(0,0,0,0.15)',
      fontSize: 12,
    },

    item: {
      padding: '5px 15px',
      borderBottom: '1px solid rgba(0,0,0,0.15)',

      '&focused': {
        backgroundColor: '#f8f6f9',
      },
    },
  },
};

export default ProjectOwnership;
