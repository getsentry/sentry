import React from 'react';

import {assignToUser, assignToActor} from 'app/actionCreators/group';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import Access from 'app/components/acl/access';
import {Organization, Group, Event, Actor, Commit, Project, User} from 'app/types';
import {Client} from 'app/api';

import {findMatchedRules, Rules} from './findMatchedRules';
import {SuggestedAssignees} from './suggestedAssignees';
import {OwnershipRules} from './ownershipRules';

type OwnerList = React.ComponentProps<typeof SuggestedAssignees>['owners'];

type Committer = {
  author: User;
  commits: Array<Commit>;
};

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  group: Group;
  event: Event;
};

type State = {
  rules: Rules;
  owners: Array<Actor>;
  committers: Array<Committer>;
};

class SuggestedOwners extends React.Component<Props, State> {
  state: State = {
    rules: null,
    owners: [],
    committers: [],
  };

  componentDidMount() {
    this.fetchData(this.props.event);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.event && prevProps.event) {
      if (this.props.event.id !== prevProps.event.id) {
        //two events, with different IDs
        this.fetchData(this.props.event);
      }
      return;
    }

    if (this.props.event) {
      //going from having no event to having an event
      this.fetchData(this.props.event);
    }
  }

  async fetchData(event: Event) {
    // No committers if you don't have any releases
    if (!!this.props.group.firstRelease) {
      this.fetchCommitters(event.id);
    }

    this.fetchOwners(event.id);
  }

  fetchCommitters = async (eventId: Event['id']) => {
    const {api, project, organization} = this.props;
    // TODO: move this into a store since `EventCause` makes this exact request as well
    try {
      const data = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/events/${eventId}/committers/`
      );
      this.setState({
        committers: data.committers,
      });
    } catch {
      this.setState({
        committers: [],
      });
    }
  };

  fetchOwners = async (eventId: Event['id']) => {
    const {api, project, organization} = this.props;

    try {
      const data = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/events/${eventId}/owners/`
      );

      this.setState({
        owners: data.owners,
        rules: data.rules,
      });
    } catch {
      this.setState({
        committers: [],
      });
    }
  };

  /**
   * Combine the commiter and ownership data into a single array, merging
   * users who are both owners based on having commits, and owners matching
   * project ownership rules into one array.
   *
   * The return array will include objects of the format:
   *
   * {
   *   actor: <
   *    type,              # Either user or team
   *    SentryTypes.User,  # API expanded user object
   *    {email, id, name}  # Sentry user which is *not* expanded
   *    {email, name}      # Unidentified user (from commits)
   *    {id, name},        # Sentry team (check `type`)
   *   >,
   *
   *   # One or both of commits and rules will be present
   *
   *   commits: [...]  # List of commits made by this owner
   *   rules:   [...]  # Project rules matched for this owner
   * }
   */
  getOwnerList() {
    const owners = this.state.committers.map(commiter => ({
      actor: {...commiter.author, type: 'user' as Actor['type']},
      commits: commiter.commits,
    })) as OwnerList;

    this.state.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: findMatchedRules(this.state.rules || [], owner),
      };

      const existingIdx = owners.findIndex(o => o.actor.email === owner.email);
      if (existingIdx > -1) {
        owners[existingIdx] = {...normalizedOwner, ...owners[existingIdx]};
        return;
      }
      owners.push(normalizedOwner);
    });

    return owners;
  }

  handleAssign = (actor: Actor) => () => {
    if (actor.id === undefined) {
      return;
    }

    const {event} = this.props;

    if (actor.type === 'user') {
      // TODO(ts): `event` here may not be 100% correct
      // in this case groupID should always exist on event
      // since this is only used in Issue Details
      assignToUser({id: event.groupID as string, user: actor});
    }

    if (actor.type === 'team') {
      assignToActor({id: event.groupID as string, actor});
    }
  };

  render() {
    const {organization, project, group} = this.props;
    const owners = this.getOwnerList();

    return (
      <React.Fragment>
        {owners.length > 0 && (
          <SuggestedAssignees owners={owners} onAssign={this.handleAssign} />
        )}
        <Access access={['project:write']}>
          <OwnershipRules
            issueId={group.id}
            project={project}
            organization={organization}
          />
        </Access>
      </React.Fragment>
    );
  }
}
export default withApi(withOrganization(SuggestedOwners));
