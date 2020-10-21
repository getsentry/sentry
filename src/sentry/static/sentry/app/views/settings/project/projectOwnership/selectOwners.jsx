import debounce from 'lodash/debounce';
import PropTypes from 'prop-types';
import {Component} from 'react';
import ReactDOM from 'react-dom';
import Reflux from 'reflux';
import styled from '@emotion/styled';

import {addTeamToProject} from 'app/actionCreators/projects';
import {t} from 'app/locale';
import {buildUserId, buildTeamId} from 'app/utils';
import {Client} from 'app/api';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import IdBadge from 'app/components/idBadge';
import MultiSelectControl from 'app/components/forms/multiSelectControl';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import {IconAdd} from 'app/icons';
import Tooltip from 'app/components/tooltip';

class ValueComponent extends Component {
  static propTypes = {
    value: PropTypes.object,
    onRemove: PropTypes.func,
  };

  handleClick = () => {
    this.props.onRemove(this.props.value);
  };

  render() {
    return (
      <a onClick={this.handleClick}>
        <ActorAvatar actor={this.props.value.actor} size={28} />
      </a>
    );
  }
}

const getSearchKeyForUser = user =>
  `${user.email && user.email.toLowerCase()} ${user.name && user.name.toLowerCase()}`;

export default class SelectOwners extends Component {
  static propTypes = {
    project: SentryTypes.Project,
    organization: SentryTypes.Organization,
    value: PropTypes.array,
    onChange: PropTypes.func,
    onInputChange: PropTypes.func,
    disabled: PropTypes.bool,
  };

  constructor(...args) {
    super(...args);
    this.api = new Client();

    // See comments in `handleAddTeamToProject` for why we close the menu this way
    this.projectsStoreMixin = Reflux.listenTo(ProjectsStore, () => {
      this.closeSelectMenu();
    });
  }

  state = {
    loading: false,
    inputValue: '',
  };

  componentDidMount() {
    if (this.projectsStoreMixin) {
      this.projectsStoreMixin.componentDidMount();
    }
  }

  componentWillUnmount() {
    this.api = null;

    if (this.projectsStoreMixin) {
      this.projectsStoreMixin.componentWillUnmount();
    }
  }

  renderUserBadge = user => (
    <IdBadge avatarSize={24} user={user} hideEmail useLink={false} />
  );

  createMentionableUser = user => ({
    value: buildUserId(user.id),
    label: this.renderUserBadge(user),
    searchKey: getSearchKeyForUser(user),
    actor: {
      type: 'user',
      id: user.id,
      name: user.name,
    },
  });

  createUnmentionableUser = ({user}) => ({
    ...this.createMentionableUser(user),
    disabled: true,
    label: (
      <DisabledLabel>
        <Tooltip
          position="left"
          title={t('%s is not a member of project', user.name || user.email)}
        >
          {this.renderUserBadge(user)}
        </Tooltip>
      </DisabledLabel>
    ),
  });

  createMentionableTeam = team => ({
    value: buildTeamId(team.id),
    label: <IdBadge team={team} />,
    searchKey: `#${team.slug}`,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug,
    },
  });

  createUnmentionableTeam = team => {
    const {organization} = this.props;
    const canAddTeam = organization.access.includes('project:write');

    return {
      ...this.createMentionableTeam(team),
      disabled: true,
      label: (
        <Container>
          <DisabledLabel>
            <Tooltip
              position="left"
              title={t('%s is not a member of project', `#${team.slug}`)}
            >
              <IdBadge team={team} />
            </Tooltip>
          </DisabledLabel>
          <Tooltip
            title={
              canAddTeam
                ? t('Add %s to project', `#${team.slug}`)
                : t('You do not have permission to add team to project.')
            }
          >
            <AddToProjectButton
              size="zero"
              borderless
              disabled={!canAddTeam}
              onClick={this.handleAddTeamToProject.bind(this, team)}
              icon={<IconAdd isCircled />}
            />
          </Tooltip>
        </Container>
      ),
    };
  };

  getMentionableUsers() {
    return MemberListStore.getAll().map(this.createMentionableUser);
  }

  getMentionableTeams() {
    const {project} = this.props;
    const projectData = ProjectsStore.getBySlug(project.slug);

    if (!projectData) {
      return [];
    }

    return projectData.teams.map(this.createMentionableTeam);
  }

  /**
   * Get list of teams that are not in the current project, for use in `MultiSelectMenu`
   *
   * @param {Team[]} teamsInProject A list of teams that are in the current project
   */
  getTeamsNotInProject(teamsInProject = []) {
    const teams = TeamStore.getAll() || [];
    const excludedTeamIds = teamsInProject.map(({actor}) => actor.id);

    return teams
      .filter(team => excludedTeamIds.indexOf(team.id) === -1)
      .map(this.createUnmentionableTeam);
  }

  /**
   * Closes the select menu by blurring input if possible since that seems to be the only
   * way to close it.
   */
  closeSelectMenu() {
    // Close select menu
    if (this.selectRef) {
      // eslint-disable-next-line react/no-find-dom-node
      const input = ReactDOM.findDOMNode(this.selectRef).querySelector(
        '.Select-input input'
      );
      if (input) {
        // I don't think there's another way to close `react-select`
        input.blur();
      }
    }
  }

  async handleAddTeamToProject(team) {
    const {organization, project, value} = this.props;
    // Copy old value
    const oldValue = [...value];

    // Optimistic update
    this.props.onChange([...this.props.value, this.createMentionableTeam(team)]);

    try {
      // Try to add team to project
      // Note: we can't close select menu here because we have to wait for ProjectsStore to update first
      // The reason for this is because we have little control over `react-select`'s `AsyncSelect`
      // We can't control when `handleLoadOptions` gets called, but it gets called when select closes, so
      // wait for store to update before closing the menu. Otherwise, we'll have stale items in the select menu
      await addTeamToProject(this.api, organization.slug, project.slug, team);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange(oldValue);
      this.closeSelectMenu();
    }
  }

  handleChange = newValue => {
    this.props.onChange(newValue);
  };

  handleInputChange = inputValue => {
    this.setState({inputValue});

    if (this.props.onInputChange) {
      this.props.onInputChange(inputValue);
    }
  };

  queryMembers = debounce((query, cb) => {
    const {organization} = this.props;

    // Because this function is debounced, the component can potentially be
    // unmounted before this fires, in which case, `this.api` is null
    if (!this.api) {
      return null;
    }

    return this.api
      .requestPromise(`/organizations/${organization.slug}/members/`, {
        query: {query},
      })
      .then(
        data => cb(null, data),
        err => cb(err)
      );
  }, 250);

  handleLoadOptions = () => {
    const usersInProject = this.getMentionableUsers();
    const teamsInProject = this.getMentionableTeams();
    const teamsNotInProject = this.getTeamsNotInProject(teamsInProject);
    const usersInProjectById = usersInProject.map(({actor}) => actor.id);

    // Return a promise for `react-select`
    return new Promise((resolve, reject) => {
      this.queryMembers(this.state.inputValue, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    })
      .then(members =>
        // Be careful here as we actually want the `users` object, otherwise it means user
        // has not registered for sentry yet, but has been invited
        members
          ? members
              .filter(({user}) => user && usersInProjectById.indexOf(user.id) === -1)
              .map(this.createUnmentionableUser)
          : []
      )
      .then(members => ({
        options: [...usersInProject, ...teamsInProject, ...teamsNotInProject, ...members],
      }));
  };

  render() {
    return (
      <MultiSelectControl
        deprecatedSelectControl
        filterOptions={(options, filterText) =>
          options.filter(({searchKey}) => searchKey.indexOf(filterText) > -1)
        }
        ref={ref => (this.selectRef = ref)}
        loadOptions={this.handleLoadOptions}
        defaultOptions
        async
        clearable
        disabled={this.props.disabled}
        cache={false}
        valueComponent={ValueComponent}
        placeholder={t('owners')}
        onInputChange={this.handleInputChange}
        onChange={this.handleChange}
        value={this.props.value}
        css={{width: 200}}
      />
    );
  }
}

const Container = styled('div')`
  display: flex;
  justify-content: space-between;
`;

const DisabledLabel = styled('div')`
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

const AddToProjectButton = styled(Button)`
  flex-shrink: 0;
`;
