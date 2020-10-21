import * as React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';

import {Client} from 'app/api';
import {Organization, Project, Event, Group, Committer} from 'app/types';
import {getCommitters} from 'app/actionCreators/committers';
import CommitterStore from 'app/stores/committerStore';
import getDisplayName from 'app/utils/getDisplayName';

type DependentProps = {
  api: Client;

  organization: Organization;
  project: Project;
  event: Event;
  group?: Group;
};

// XXX: State does not include loading/error because components using this
// HOC (suggestedOwners, eventCause) do not have loading/error states. However,
// the store maintains those states if it is needed in the future.
type InjectedProps = {
  committers: Committer[];
};

const initialState: InjectedProps = {
  committers: [],
};

const withCommitters = <P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedProps> & Partial<InjectedProps> & DependentProps,
    InjectedProps
  >({
    displayName: `withCommitters(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(CommitterStore, 'onStoreUpdate') as any],

    getInitialState() {
      const {organization, project, event} = this.props as P & DependentProps;
      const repoData = CommitterStore.get(organization.slug, project.slug, event.id);

      return {...initialState, ...repoData};
    },

    componentDidMount() {
      const {group} = this.props as P & DependentProps;

      // No committers if group doesn't have any releases
      if (!!group?.firstRelease) {
        this.fetchCommitters();
      }
    },

    fetchCommitters() {
      const {api, organization, project, event} = this.props as P & DependentProps;
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
    },

    onStoreUpdate() {
      const {organization, project, event} = this.props as P & DependentProps;
      const repoData = CommitterStore.get(organization.slug, project.slug, event.id);
      this.setState({committers: repoData.committers});
    },

    render() {
      const {committers = []} = this.state as InjectedProps;

      // XXX: We do not pass loading/error states because the components using
      // this HOC (suggestedOwners, eventCause) do not have loading/error states
      return (
        <WrappedComponent
          {...(this.props as P & DependentProps)}
          committers={committers}
        />
      );
    },
  });

export default withCommitters;
