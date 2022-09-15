import {Fragment} from 'react';

import {assignToActor, assignToUser} from 'sentry/actionCreators/group';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import AsyncComponent from 'sentry/components/asyncComponent';
import type {
  Actor,
  CodeOwner,
  Committer,
  Group,
  Organization,
  Project,
  ReleaseCommitter,
} from 'sentry/types';
import type {Event} from 'sentry/types/event';
import {getIssueCapability} from 'sentry/utils/groupCapabilities';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import useCommitters from 'sentry/utils/useCommitters';
import useOrganization from 'sentry/utils/useOrganization';

import {findMatchedRules, Rules} from './findMatchedRules';
import {OwnershipRules} from './ownershipRules';
import {SuggestedAssignees} from './suggestedAssignees';

type OwnerList = React.ComponentProps<typeof SuggestedAssignees>['owners'];

type Props = {
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
  committers?: Committer[];
  releaseCommitters?: ReleaseCommitter[];
} & AsyncComponent['props'];

type State = {
  codeowners: CodeOwner[];
  eventOwners: {owners: Array<Actor>; rules: Rules};
  isDismissed: boolean;
} & AsyncComponent['state'];

class SuggestedOwners extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      event: {rules: [], owners: []},
      codeowners: [],
      isDismissed: true,
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
    if (organization.features.includes('integrations-codeowners')) {
      endpoints.push([
        `codeowners`,
        `/projects/${organization.slug}/${project.slug}/codeowners/`,
      ]);
    }

    return endpoints as ReturnType<AsyncComponent['getEndpoints']>;
  }

  async onLoadAllEndpointsSuccess() {
    await this.checkCodeOwnersPrompt();
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

  async checkCodeOwnersPrompt() {
    const {organization, project} = this.props;

    this.setState({loading: true});
    // check our prompt backend
    const promptData = await promptsCheck(this.api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: 'code_owners',
    });
    const isDismissed = promptIsDismissed(promptData, 30);
    this.setState({isDismissed, loading: false}, () => {
      if (!isDismissed) {
        // now record the results
        trackIntegrationAnalytics(
          'integrations.show_code_owners_prompt',
          {
            view: 'stacktrace_issue_details',
            project_id: project.id,
            organization,
          },
          {startSession: true}
        );
      }
    });
  }

  handleCTAClose = () => {
    const {organization, project} = this.props;

    promptsUpdate(this.api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: 'code_owners',
      status: 'dismissed',
    });

    this.setState({isDismissed: true}, () =>
      trackIntegrationAnalytics('integrations.dismissed_code_owners_prompt', {
        view: 'stacktrace_issue_details',
        project_id: project.id,
        organization,
      })
    );
  };

  /**
   * Combine the committer and ownership data into a single array, merging
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
    const committers = this.props.committers ?? [];
    const releaseCommitters = this.props.releaseCommitters ?? [];
    const owners: OwnerList = [...committers, ...releaseCommitters].map(commiter => ({
      actor: {...commiter.author, type: 'user'},
      commits: commiter.commits,
      release: (commiter as ReleaseCommitter).release,
    }));

    this.state.eventOwners.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: findMatchedRules(this.state.eventOwners.rules || [], owner),
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

  renderBody() {
    const {organization, project, group} = this.props;
    const {codeowners, isDismissed} = this.state;
    const owners = this.getOwnerList();
    const codeownersCapability = getIssueCapability(group.issueCategory, 'codeowners');

    return (
      <Fragment>
        {owners.length > 0 && (
          <SuggestedAssignees
            organization={organization}
            owners={owners}
            projectId={group.project.id}
            onAssign={this.handleAssign}
          />
        )}
        {codeownersCapability.enabled && (
          <OwnershipRules
            issueId={group.id}
            project={project}
            organization={organization}
            codeowners={codeowners}
            isDismissed={isDismissed}
            handleCTAClose={this.handleCTAClose}
          />
        )}
      </Fragment>
    );
  }
}

function SuggestedOwnersWrapper(props: Omit<Props, 'committers' | 'organization'>) {
  const organization = useOrganization();
  const {committers, releaseCommitters} = useCommitters({
    group: props.group,
    eventId: props.event.id,
    projectSlug: props.project.slug,
  });

  return (
    <SuggestedOwners
      organization={organization}
      committers={committers}
      releaseCommitters={releaseCommitters}
      {...props}
    />
  );
}

export default SuggestedOwnersWrapper;
