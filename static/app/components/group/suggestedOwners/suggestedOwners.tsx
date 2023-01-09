import {assignToActor, assignToUser} from 'sentry/actionCreators/group';
import AsyncComponent from 'sentry/components/asyncComponent';
import type {Actor, Committer, Group, Organization, Project} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

import {findMatchedRules, Rules} from './findMatchedRules';
import {SuggestedAssignees} from './suggestedAssignees';

type OwnerList = React.ComponentProps<typeof SuggestedAssignees>['owners'];

type Props = {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
  committers?: Committer[];
} & AsyncComponent['props'];

type State = {
  eventOwners: {owners: Array<Actor>; rules: Rules} | null;
} & AsyncComponent['state'];

class SuggestedOwners extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      event: {rules: [], owners: []},
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization, event} = this.props;
    const endpoints = [
      [
        'eventOwners',
        `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      ],
    ];

    return endpoints as ReturnType<AsyncComponent['getEndpoints']>;
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.event && prevProps.event) {
      if (this.props.event.id !== prevProps.event.id) {
        // two events, with different IDs
        this.reloadData();
      }
      return;
    }

    if (this.props.event) {
      // going from having no event to having an event
      this.reloadData();
    }
  }

  /**
   * Combine the committer and ownership data into a single array, merging
   * users who are both owners based on having commits, and owners matching
   * project ownership rules into one array.
   *
   * ### The return array will include objects of the format:
   *
   * ```ts
   *   actor: <
   *    type,              # Either user or team
   *    SentryTypes.User,  # API expanded user object
   *    {email, id, name}  # Sentry user which is *not* expanded
   *    {email, name}      # Unidentified user (from commits)
   *    {id, name},        # Sentry team (check `type`)
   *   >,
   * ```
   *
   * ### One or both of commits and rules will be present
   *
   * ```ts
   *   commits: [...]  # List of commits made by this owner
   *   rules:   [...]  # Project rules matched for this owner
   * ```
   */
  getOwnerList(): OwnerList {
    const committers = this.props.committers ?? [];
    const owners: OwnerList = committers.map(commiter => ({
      actor: {...commiter.author, type: 'user'},
      commits: commiter.commits,
      source: 'suspectCommit',
    }));

    this.state.eventOwners?.owners.forEach(owner => {
      const matchingRule = findMatchedRules(this.state.eventOwners?.rules || [], owner);
      const normalizedOwner: OwnerList[0] = {
        actor: owner,
        rules: matchingRule,
        source: matchingRule?.[0] === 'codeowners' ? 'codeowners' : 'projectOwnership',
      };

      const existingIdx =
        committers.length > 0 && owner.email && owner.type === 'user'
          ? owners.findIndex(o => o.actor.email === owner.email)
          : -1;
      if (existingIdx > -1) {
        owners[existingIdx] = {...normalizedOwner, ...owners[existingIdx]};
        return;
      }
      owners.push(normalizedOwner);
    });

    // Do not display current assignee
    const assignedTo = this.props.group.assignedTo;
    return owners.filter(
      owner =>
        !(owner.actor.type === assignedTo?.type && owner.actor.id === assignedTo?.id)
    );
  }

  handleAssign = (actor: Actor) => {
    if (actor.id === undefined) {
      return;
    }

    const {event} = this.props;

    if (actor.type === 'user') {
      // TODO(ts): `event` here may not be 100% correct
      // in this case groupID should always exist on event
      // since this is only used in Issue Details
      assignToUser({
        id: event.groupID as string,
        user: actor,
        assignedBy: 'suggested_assignee',
      });
    }

    if (actor.type === 'team') {
      assignToActor({
        id: event.groupID as string,
        actor,
        assignedBy: 'suggested_assignee',
      });
    }
  };

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {organization, group} = this.props;
    const {loading} = this.state;
    const owners = this.getOwnerList();

    return (
      <SuggestedAssignees
        group={group}
        organization={organization}
        owners={owners}
        projectId={group.project.id}
        onAssign={this.handleAssign}
        loading={loading}
      />
    );
  }
}

function SuggestedOwnersWrapper(props: Omit<Props, 'committers' | 'organization'>) {
  const organization = useOrganization();
  const {data} = useCommitters(
    {
      eventId: props.event.id,
      projectSlug: props.project.slug,
    },
    {notifyOnChangeProps: ['data'], enabled: !defined(props.group.assignedTo)}
  );

  if (defined(props.group.assignedTo)) {
    return null;
  }

  return (
    <SuggestedOwners
      organization={organization}
      committers={data?.committers ?? []}
      {...props}
    />
  );
}

export default SuggestedOwnersWrapper;
