import {Component} from 'react';

import {getCommitters} from 'sentry/actionCreators/committers';
import {Client} from 'sentry/api';
import CommitterStore from 'sentry/stores/committerStore';
import {AvatarProject, Committer, Group, Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import getDisplayName from 'sentry/utils/getDisplayName';

type DependentProps = {
  api: Client;

  event: Event;
  organization: Organization;
  project: Project | AvatarProject;
  group?: Group;
};

// XXX: State does not include loading/error because components using this
// HOC (suggestedOwners, eventCause) do not have loading/error states. However,
// the store maintains those states if it is needed in the future.
type InjectedProps = {
  committers?: Committer[];
};

const initialState: InjectedProps = {
  committers: [],
};

function withCommitters<P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) {
  class WithCommitters extends Component<
    Omit<P, keyof InjectedProps> & Partial<InjectedProps> & DependentProps,
    InjectedProps
  > {
    static displayName = `withCommitters(${getDisplayName(WrappedComponent)})`;

    constructor(props: P, context: any) {
      super(props, context);

      const {organization, project, event} = this.props;
      const repoData = CommitterStore.get(organization.slug, project.slug, event.id);

      this.state = {...initialState, ...repoData} as InjectedProps;
    }

    componentDidMount() {
      const {group} = this.props;

      // No committers if group doesn't have any releases
      if (!!group?.firstRelease) {
        this.fetchCommitters();
      }
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = CommitterStore.listen(() => this.onStoreUpdate(), undefined);

    fetchCommitters() {
      const {api, organization, project, event} = this.props;
      const repoData = CommitterStore.get(organization.slug, project.slug, event.id);

      if (
        (!repoData.committers && !repoData.committersLoading) ||
        repoData.committersError
      ) {
        getCommitters(api, {
          orgSlug: organization.slug,
          projectSlug: project.slug,
          eventId: event.id,
        });
      }
    }

    onStoreUpdate() {
      const {organization, project, event} = this.props;
      const repoData = CommitterStore.get(organization.slug, project.slug, event.id);
      this.setState({committers: repoData.committers});
    }

    render() {
      const {committers = []} = this.state;
      // XXX: We do not pass loading/error states because the components using
      // this HOC (suggestedOwners, eventCause) do not have loading/error states
      return (
        <WrappedComponent
          {...(this.props as P & DependentProps)}
          committers={committers}
        />
      );
    }
  }
  return WithCommitters;
}

export default withCommitters;
