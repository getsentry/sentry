import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';
import {MentionsInput, Mention} from 'react-mentions';

import {Client} from '../../../../api';
import memberListStore from '../../../../stores/memberListStore';
import ProjectsStore from '../../../../stores/projectsStore';
import Button from '../../../../components/buttons/button';
import SentryTypes from '../../../../proptypes';

import {addErrorMessage, addSuccessMessage} from '../../../../actionCreators/indicator';
import {t} from '../../../../locale';
import OwnerInputStyle from './ownerInputStyles';

const SyntaxOverlay = styled.div`
  margin: 5px;
  padding: 0px;
  width: calc(100% - 10px);
  height: 1em;
  background-color: red;
  opacity: 0.1;
  pointer-events: none;
  position: absolute;
  top: ${({line}) => line}em;
`;

class OwnerInput extends React.Component {
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

  handleUpdateOwnership = () => {
    let {organization, project} = this.props;
    this.setState({error: null});

    const api = new Client();
    let request = api.requestPromise(
      `/projects/${organization.slug}/${project.slug}/ownership/`,
      {
        method: 'PUT',
        data: {raw: this.state.text},
      }
    );

    request
      .then(() => {
        addSuccessMessage(t('Updated ownership rules'));
      })
      .catch(error => {
        this.setState({error: error.responseJSON});
        addErrorMessage(t('Error updating ownership rules'));
      });

    return request;
  };

  mentionableUsers() {
    return memberListStore.getAll().map(member => ({
      id: member.id,
      display: member.email,
      email: member.email,
    }));
  }

  mentionableTeams() {
    let {project} = this.props;
    return (ProjectsStore.getAll().find(p => p.slug == project.slug) || {
      teams: [],
    }).teams.map(team => ({
      id: team.id,
      display: `#${team.slug}`,
      email: team.id,
    }));
  }

  onChange(v) {
    this.setState({text: v.target.value});
  }
  render() {
    let {initialText} = this.props;
    let {text, error} = this.state;

    let mentionableUsers = this.mentionableUsers();
    let mentionableTeams = this.mentionableTeams();

    return (
      <React.Fragment>
        <div
          style={{position: 'relative'}}
          onKeyDown={e => {
            if (e.metaKey && e.key == 'Enter') {
              this.handleUpdateOwnership();
            }
          }}
        >
          <MentionsInput
            style={OwnerInputStyle}
            placeholder={
              '#example usage\n\npath:src/sentry/pipeline/* person@sentry.io #platform\n\nurl:http://sentry.io/settings/* #workflow'
            }
            onChange={this.onChange.bind(this)}
            onBlur={this.onBlur}
            onKeyDown={this.onKeyDown}
            value={text}
            required={true}
            autoFocus={true}
            displayTransform={(id, display, type) => `${display}`}
            markup="**[sentry.strip:__type__]__display__**"
            spellCheck="false"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          >
            <Mention
              type="member"
              trigger="@"
              data={mentionableUsers}
              appendSpaceOnAdd={true}
            />
            <Mention
              type="team"
              trigger="#"
              data={mentionableTeams}
              appendSpaceOnAdd={true}
            />
          </MentionsInput>
          {error &&
            error.raw && (
              <SyntaxOverlay line={error.raw[0].match(/line (\d*),/)[1] - 1} />
            )}
          {error && error.raw.toString()}
          <div style={{textAlign: 'end', paddingTop: '10px'}}>
            <Button
              size="small"
              priority="primary"
              onClick={this.handleUpdateOwnership}
              disabled={text === initialText}
            >
              {t('Save Changes')}
            </Button>
          </div>
        </div>
      </React.Fragment>
    );
  }
}

export default OwnerInput;
