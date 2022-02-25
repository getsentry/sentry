import * as React from 'react';

import {assignToActor, assignToUser} from 'sentry/actionCreators/group';
import {promptsCheck, promptsUpdate} from 'sentry/actionCreators/prompts';
import {Client} from 'sentry/api';
import AsyncComponent from 'sentry/components/asyncComponent';
import {
  Actor,
  CodeOwner,
  Committer,
  Group,
  Organization,
  Project,
  RepositoryProjectPathConfig,
} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {trackIntegrationAnalytics} from 'sentry/utils/integrationUtil';
import {promptIsDismissed} from 'sentry/utils/promptIsDismissed';
import withApi from 'sentry/utils/withApi';
import withCommitters from 'sentry/utils/withCommitters';
import withOrganization from 'sentry/utils/withOrganization';

import {findMatchedRules, Rules} from './findMatchedRules';
import {OwnershipRules} from './ownershipRules';
import {SuggestedAssignees} from './suggestedAssignees';

type OwnerList = React.ComponentProps<typeof SuggestedAssignees>['owners'];

type Props = {
  api: Client;
  event: Event;
  group: Group;
  organization: Organization;
  project: Project;
  committers?: Committer[];
} & AsyncComponent['props'];

type State = {
  codeMappings: RepositoryProjectPathConfig[];
  codeowners: CodeOwner[];
  event_owners: {owners: Array<Actor>; rules: Rules};
  isDismissed: boolean;
} & AsyncComponent['state'];

class SuggestedOwners extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      event: {rules: [], owners: []},
      codeowners: [],
      isDismissed: true,
      codeMappings: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {project, organization, event} = this.props;
    const endpoints = [
      [
        'event_owners',
        `/projects/${organization.slug}/${project.slug}/events/${event.id}/owners/`,
      ],
      [
        'codeMappings',
        `/organizations/${organization.slug}/code-mappings/`,
        {query: {project: -1}},
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
    const {api, organization, project} = this.props;
    const {codeMappings} = this.state;

    // Show CTA to all orgs that have Stack Trace Linking setup.
    if (!codeMappings.length) {
      return;
    }
    this.setState({loading: true});
    // check our prompt backend
    const promptData = await promptsCheck(api, {
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
    const {api, organization, project} = this.props;

    promptsUpdate(api, {
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
    const committers = this.props.committers ?? [];
    const owners = committers.map(commiter => ({
      actor: {...commiter.author, type: 'user' as Actor['type']},
      commits: commiter.commits,
    })) as OwnerList;

    this.state.event_owners.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: findMatchedRules(this.state.event_owners.rules || [], owner),
      };

      const existingIdx = owners.findIndex(o =>
        committers.length === 0 ? o.actor === owner : o.actor.email === owner.email
      );
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
    return (
      <React.Fragment>
        {owners.length > 0 && (
          <SuggestedAssignees owners={owners} onAssign={this.handleAssign} />
        )}
        <OwnershipRules
          issueId={group.id}
          project={project}
          organization={organization}
          codeowners={codeowners}
          isDismissed={isDismissed}
          handleCTAClose={this.handleCTAClose}
        />
      </React.Fragment>
    );
  }
}
export default withApi(withOrganization(withCommitters(SuggestedOwners)));
