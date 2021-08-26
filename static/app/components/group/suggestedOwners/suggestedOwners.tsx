import * as React from 'react';

import {assignToActor, assignToUser} from 'app/actionCreators/group';
import {promptsCheck, promptsUpdate} from 'app/actionCreators/prompts';
import {Client} from 'app/api';
import {Actor, CodeOwner, Committer, Group, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import {trackIntegrationAnalytics} from 'app/utils/integrationUtil';
import {promptIsDismissed} from 'app/utils/promptIsDismissed';
import withApi from 'app/utils/withApi';
import withCommitters from 'app/utils/withCommitters';
import withOrganization from 'app/utils/withOrganization';

import {findMatchedRules, Rules} from './findMatchedRules';
import {OwnershipRules} from './ownershipRules';
import {SuggestedAssignees} from './suggestedAssignees';

type OwnerList = React.ComponentProps<typeof SuggestedAssignees>['owners'];

type Props = {
  api: Client;
  organization: Organization;
  project: Project;
  group: Group;
  event: Event;
  committers?: Committer[];
};

type State = {
  rules: Rules;
  owners: Array<Actor>;
  codeowners: CodeOwner[];
  isDismissed: boolean;
};

class SuggestedOwners extends React.Component<Props, State> {
  state: State = {
    rules: null,
    owners: [],
    codeowners: [],
    isDismissed: true,
  };

  componentDidMount() {
    this.fetchData(this.props.event);
  }

  componentDidUpdate(prevProps: Props) {
    if (this.props.event && prevProps.event) {
      if (this.props.event.id !== prevProps.event.id) {
        // two events, with different IDs
        this.fetchData(this.props.event);
      }
      return;
    }

    if (this.props.event) {
      // going from having no event to having an event
      this.fetchData(this.props.event);
    }
  }

  async fetchData(event: Event) {
    this.fetchOwners(event.id);
    this.fetchCodeOwners();
    this.checkCodeOwnersPrompt();
  }

  async checkCodeOwnersPrompt() {
    const {api, organization, project} = this.props;

    // check our prompt backend
    const promptData = await promptsCheck(api, {
      organizationId: organization.id,
      projectId: project.id,
      feature: 'code_owners',
    });
    const isDismissed = promptIsDismissed(promptData, 30);
    this.setState({isDismissed}, () => {
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

  fetchCodeOwners = async () => {
    const {api, project, organization} = this.props;

    try {
      const data = await api.requestPromise(
        `/projects/${organization.slug}/${project.slug}/codeowners/`
      );
      this.setState({
        codeowners: data,
      });
    } catch {
      this.setState({
        codeowners: [],
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
        rules: data.rules,
        owners: data.owners,
      });
    } catch {
      this.setState({
        rules: null,
        owners: [],
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
    const committers = this.props.committers ?? [];
    const owners = committers.map(commiter => ({
      actor: {...commiter.author, type: 'user' as Actor['type']},
      commits: commiter.commits,
    })) as OwnerList;

    this.state.owners.forEach(owner => {
      const normalizedOwner = {
        actor: owner,
        rules: findMatchedRules(this.state.rules || [], owner),
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

  render() {
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
