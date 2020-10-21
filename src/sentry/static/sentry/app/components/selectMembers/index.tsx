import * as React from 'react';
import debounce from 'lodash/debounce';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {IconAdd} from 'app/icons';
import {Member, Organization, Project, Team, User} from 'app/types';
import {addTeamToProject} from 'app/actionCreators/projects';
import {callIfFunction} from 'app/utils/callIfFunction';
import {t} from 'app/locale';
import Button from 'app/components/button';
import IdBadge from 'app/components/idBadge';
import MemberListStore from 'app/stores/memberListStore';
import ProjectsStore from 'app/stores/projectsStore';
import SelectControl from 'app/components/forms/selectControl';
import TeamStore from 'app/stores/teamStore';
import Tooltip from 'app/components/tooltip';
import withApi from 'app/utils/withApi';

const getSearchKeyForUser = (user: User) =>
  `${user.email && user.email.toLowerCase()} ${user.name && user.name.toLowerCase()}`;

type Actor<T> = {
  type: T;
  id: string;
  name: string;
};

type Mentionable<T> = {
  value: string;
  label: React.ReactElement;
  searchKey: string;
  actor: Actor<T>;
};

type Unmentionable = {
  disabled: boolean;
  label: React.ReactElement;
};

type MentionableTeam = Mentionable<'team'>;
type UnmentionableTeam = MentionableTeam & Unmentionable;
type MentionableUser = Mentionable<'user'>;
type UnmentionableUser = MentionableUser & Unmentionable;

type AllMentionable = (MentionableUser | MentionableTeam) & Partial<Unmentionable>;

type Props = {
  api: Client;
  project?: Project;
  organization: Organization;
  value: any;
  showTeam: boolean;
  onChange: (value: any) => any;
  onInputChange?: (value: any) => any;
  disabled?: boolean;
  placeholder?: string;
  styles?: {control?: (provided: any) => any};
};

type State = {
  loading: boolean;
  memberListLoading: boolean;
  inputValue: string;
  options: AllMentionable[] | null;
};

type FilterOption<T> = {
  value: string;
  label: React.ReactNode;
  data: T;
};

/**
 * A component that allows you to select either members and/or teams
 */
class SelectMembers extends React.Component<Props, State> {
  state: State = {
    loading: false,
    inputValue: '',
    options: null,
    memberListLoading: !MemberListStore.isLoaded(),
  };

  componentWillUnmount() {
    this.unlisteners.forEach(callIfFunction);
  }

  selectRef = React.createRef<typeof SelectControl>();

  unlisteners = [
    MemberListStore.listen(() => {
      this.setState({
        memberListLoading: !MemberListStore.isLoaded(),
      });
    }, undefined),
  ];

  renderUserBadge = (user: User) => (
    <IdBadge avatarSize={24} user={user} hideEmail useLink={false} />
  );

  createMentionableUser = (user: User): MentionableUser => ({
    value: user.id,
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

  createMentionableTeam = (team: Team): MentionableTeam => ({
    value: team.id,
    label: <IdBadge team={team} />,
    searchKey: `#${team.slug}`,
    actor: {
      type: 'team',
      id: team.id,
      name: team.slug,
    },
  });

  createUnmentionableTeam = (team: Team): UnmentionableTeam => {
    const {organization} = this.props;
    const canAddTeam = organization.access.includes('project:write');

    return {
      ...this.createMentionableTeam(team),
      disabled: true,
      label: (
        <UnmentionableTeam>
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
              type="button"
              size="zero"
              borderless
              disabled={!canAddTeam}
              onClick={this.handleAddTeamToProject.bind(this, team)}
              icon={<IconAdd isCircled />}
            />
          </Tooltip>
        </UnmentionableTeam>
      ),
    };
  };

  getMentionableUsers() {
    return MemberListStore.getAll().map(this.createMentionableUser);
  }

  getMentionableTeams(): MentionableTeam[] {
    const {project} = this.props;
    const projectData = project && ProjectsStore.getBySlug(project.slug);

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
  getTeamsNotInProject(teamsInProject: MentionableTeam[] = []): UnmentionableTeam[] {
    const teams: Team[] = TeamStore.getAll() || [];
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
    if (!this.selectRef.current) {
      return;
    }

    const select = this.selectRef.current.select.select;
    const input: HTMLInputElement = select.inputRef;
    if (input) {
      // I don't think there's another way to close `react-select`
      input.blur();
    }
  }

  async handleAddTeamToProject(team: Team) {
    const {api, organization, project, value} = this.props;
    const {options} = this.state;

    // Copy old value
    const oldValue = [...value];

    // Optimistic update
    this.props.onChange(this.createMentionableTeam(team));

    try {
      // Try to add team to project
      if (project) {
        await addTeamToProject(api, organization.slug, project.slug, team);

        // Remove add to project button without changing order
        const newOptions = options!.map(option => {
          if (option.actor.id === team.id) {
            option.disabled = false;
            option.label = <IdBadge team={team} />;
          }

          return option;
        });
        this.setState({options: newOptions});
      }
    } catch (err) {
      // Unable to add team to project, revert select menu value
      this.props.onChange(oldValue);
    }
    this.closeSelectMenu();
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
    const {api, organization} = this.props;

    // Because this function is debounced, the component can potentially be
    // unmounted before this fires, in which case, `api` is null
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

  handleLoadOptions = (): Promise<AllMentionable[]> => {
    if (this.props.showTeam) {
      const teamsInProject = this.getMentionableTeams();
      const teamsNotInProject = this.getTeamsNotInProject(teamsInProject);
      const options = [...teamsInProject, ...teamsNotInProject];
      this.setState({options});
      return Promise.resolve(options);
    }

    const usersInProject = this.getMentionableUsers();
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
      .then(
        members =>
          // Be careful here as we actually want the `users` object, otherwise it means user
          // has not registered for sentry yet, but has been invited
          (members
            ? (members as Member[])
                .filter(({user}) => user && usersInProjectById.indexOf(user.id) === -1)
                .map(this.createUnmentionableUser)
            : []) as UnmentionableUser[]
      )
      .then((members: UnmentionableUser[]) => {
        const options = [...usersInProject, ...members];
        this.setState({options});
        return options;
      });
  };

  render() {
    const {placeholder, styles} = this.props;

    // If memberList is still loading we need to disable a placeholder Select,
    // otherwise `react-select` will call `loadOptions` and prematurely load
    // options
    if (this.state.memberListLoading) {
      return <StyledSelectControl isDisabled placeholder={t('Loading')} />;
    }

    return (
      <StyledSelectControl
        ref={this.selectRef}
        filterOption={(option: FilterOption<AllMentionable>, filterText: string) =>
          option?.data?.searchKey?.indexOf(filterText) > -1
        }
        loadOptions={this.handleLoadOptions}
        isOptionDisabled={option => option.disabled}
        defaultOptions
        async
        isDisabled={this.props.disabled}
        cacheOptions={false}
        placeholder={placeholder}
        onInputChange={this.handleInputChange}
        onChange={this.handleChange}
        value={this.state.options?.find(({value}) => value === this.props.value)}
        styles={styles}
      />
    );
  }
}

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden; /* Needed so that "Add to team" button can fit */
`;

const AddToProjectButton = styled(Button)`
  flex-shrink: 0;
`;

const UnmentionableTeam = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
`;

const StyledSelectControl = styled(SelectControl)`
  .Select-value {
    display: flex;
    align-items: center;
  }
  .Select-input {
    margin-left: 32px;
  }
`;

export default withApi(SelectMembers);
