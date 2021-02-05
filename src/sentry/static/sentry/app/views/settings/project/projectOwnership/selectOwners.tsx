import React from 'react';
import ReactDOM from 'react-dom';
import {MultiValueProps} from 'react-select';
import styled from '@emotion/styled';
import debounce from 'lodash/debounce';
import isEqual from 'lodash/isEqual';

import {addTeamToProject} from 'app/actionCreators/projects';
import {Client} from 'app/api';
import ActorAvatar from 'app/components/avatar/actorAvatar';
import Button from 'app/components/button';
import MultiSelectControl from 'app/components/forms/multiSelectControl';
import IdBadge from 'app/components/idBadge';
import Tooltip from 'app/components/tooltip';
import {IconAdd} from 'app/icons';
import {t} from 'app/locale';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import TeamStore from 'app/stores/teamStore';
import space from 'app/styles/space';
import {Actor, Member, Organization, Project, Team, User} from 'app/types';
import {buildTeamId, buildUserId} from 'app/utils';
import withApi from 'app/utils/withApi';
import withProjects from 'app/utils/withProjects';

export type Owner = {
  value: string;
  label: React.ReactNode;
  searchKey: string;
  actor: Actor;
  disabled?: boolean;
};

function ValueComponent({data, removeProps}: MultiValueProps<Owner>) {
  return (
    <ValueWrapper onClick={removeProps.onClick}>
      <ActorAvatar actor={data.actor} size={28} />
    </ValueWrapper>
  );
}

const getSearchKeyForUser = (user: User) =>
  `${user.email && user.email.toLowerCase()} ${user.name && user.name.toLowerCase()}`;

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  projects: Project[];
  value: any;
  onChange: (owners: Owner[]) => void;
  disabled: boolean;
  onInputChange?: (text: string) => void;
};

type State = {
  loading: boolean;
  inputValue: string;
};

class SelectOwners extends React.Component<Props, State> {
  state = {
    loading: false,
    inputValue: '',
  };

  componentDidUpdate(prevProps: Props) {
    // Once a team has been added to the project the menu can be closed.
    if (!isEqual(this.props.projects, prevProps.projects)) {
      this.closeSelectMenu();
    }
  }

  private selectRef = React.createRef<React.ReactInstance>();

  renderUserBadge = (user: User) => (
    <IdBadge avatarSize={24} user={user} hideEmail useLink={false} />
  );

  createMentionableUser = (user: User): Owner => ({
    value: buildUserId(user.id),
    label: this.renderUserBadge(user),
    searchKey: getSearchKeyForUser(user),
    actor: {
      type: 'user' as const,
      id: user.id,
      name: user.name,
    },
  });

  createUnmentionableUser = ({user}): Owner => ({
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

  createMentionableTeam = (team: Team): Owner => ({
    value: buildTeamId(team.id),
    label: <IdBadge team={team} />,
    searchKey: `#${team.slug}`,
    actor: {
      type: 'team' as const,
      id: team.id,
      name: team.slug,
    },
  });

  createUnmentionableTeam = (team: Team): Owner => {
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
   */
  getTeamsNotInProject(teamsInProject: Owner[] = []) {
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
    if (this.selectRef.current) {
      // eslint-disable-next-line react/no-find-dom-node
      const node = ReactDOM.findDOMNode(this.selectRef.current);
      const input: HTMLInputElement | null = (node as Element)?.querySelector(
        '.Select-input input'
      );
      if (input) {
        // I don't think there's another way to close `react-select`
        input.blur();
      }
    }
  }

  async handleAddTeamToProject(team) {
    const {api, organization, project, value} = this.props;
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
      await addTeamToProject(api, organization.slug, project.slug, team);
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange(oldValue);
      this.closeSelectMenu();
    }
  }

  handleChange = (newValue: Owner[]) => {
    this.props.onChange(newValue);
  };

  handleInputChange = (inputValue: string) => {
    this.setState({inputValue});

    if (this.props.onInputChange) {
      this.props.onInputChange(inputValue);
    }
  };

  queryMembers = debounce((query, cb) => {
    const {api, organization} = this.props;

    // Because this function is debounced, the component can potentially be
    // unmounted before this fires, in which case, `this.api` is null
    if (!api) {
      return null;
    }

    return api
      .requestPromise(`/organizations/${organization.slug}/members/`, {
        query: {query},
      })
      .then(
        (data: Member[]) => cb(null, data),
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
          ? (members as Member[])
              .filter(({user}) => user && usersInProjectById.indexOf(user.id) === -1)
              .map(this.createUnmentionableUser)
          : []
      )
      .then(members => {
        return [...usersInProject, ...teamsInProject, ...teamsNotInProject, ...members];
      });
  };

  render() {
    return (
      <MultiSelectControl
        name="owners"
        filterOption={(option, filterText) =>
          option.data.searchKey.indexOf(filterText) > -1
        }
        ref={this.selectRef}
        loadOptions={this.handleLoadOptions}
        defaultOptions
        async
        clearable
        disabled={this.props.disabled}
        cache={false}
        placeholder={t('owners')}
        components={{
          MultiValue: ValueComponent,
        }}
        onInputChange={this.handleInputChange}
        onChange={this.handleChange}
        value={this.props.value}
        css={{width: 200}}
      />
    );
  }
}

export default withApi(withProjects(SelectOwners));

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

const ValueWrapper = styled('a')`
  margin-right: ${space(0.5)};
`;
