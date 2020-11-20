import React from 'react';
import createReactClass from 'create-react-class';
import Reflux from 'reflux';

import {getProjectRelease, getReleaseDeploys} from 'app/actionCreators/release';
import {Client} from 'app/api';
import ReleaseStore from 'app/stores/releaseStore';
import {Deploy, Release} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type DependentProps = {
  api: Client;
  orgSlug: string;
  projectSlug: string;
  releaseVersion: string;
};

type InjectedProps = {
  release?: Release;
  releaseLoading?: boolean;
  releaseError?: Error;
  deploys?: Array<Deploy>;
  deploysLoading?: boolean;
  deploysError?: Error;
};

const withRelease = <P extends DependentProps>(
  WrappedComponent: React.ComponentType<P>
) =>
  createReactClass<
    Omit<P, keyof InjectedProps> & Partial<InjectedProps> & DependentProps,
    InjectedProps
  >({
    displayName: `withRelease(${getDisplayName(WrappedComponent)})`,
    mixins: [Reflux.listenTo(ReleaseStore, 'onStoreUpdate') as any],

    getInitialState() {
      const {projectSlug, releaseVersion} = this.props as P & DependentProps;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);
      return {...releaseData};
    },

    componentDidMount() {
      this.fetchRelease();
      this.fetchDeploys();
    },

    fetchRelease() {
      const {api, orgSlug, projectSlug, releaseVersion} = this.props as P &
        DependentProps;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);

      if (
        (!releaseData.release && !releaseData.releaseLoading) ||
        releaseData.releaseError
      ) {
        getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      }
    },

    fetchDeploys() {
      const {api, orgSlug, projectSlug, releaseVersion} = this.props as P &
        DependentProps;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);

      if (
        (!releaseData.deploys && !releaseData.deploysLoading) ||
        releaseData.deploysError
      ) {
        getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      }
    },

    onStoreUpdate() {
      const {projectSlug, releaseVersion} = this.props as P & DependentProps;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);

      this.setState({...releaseData});
    },

    render() {
      return (
        <WrappedComponent
          {...(this.props as P & DependentProps)}
          {...(this.state as InjectedProps)}
        />
      );
    },
  });

export default withRelease;
