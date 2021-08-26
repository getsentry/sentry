import * as React from 'react';

import {getProjectRelease, getReleaseDeploys} from 'app/actionCreators/release';
import {Client} from 'app/api';
import ReleaseStore from 'app/stores/releaseStore';
import {Deploy, Organization, Release} from 'app/types';
import getDisplayName from 'app/utils/getDisplayName';

type DependentProps = {
  api: Client;
  organization: Organization;
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

function withRelease<P extends DependentProps>(WrappedComponent: React.ComponentType<P>) {
  class WithRelease extends React.Component<
    Omit<P, keyof InjectedProps> & Partial<InjectedProps> & DependentProps,
    InjectedProps
  > {
    static displayName = `withRelease(${getDisplayName(WrappedComponent)})`;

    constructor(props, context) {
      super(props, context);

      const {projectSlug, releaseVersion} = this.props;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);
      this.state = {...releaseData};
    }

    componentDidMount() {
      this.fetchRelease();
      this.fetchDeploys();
    }

    componentWillUnmount() {
      this.unsubscribe();
    }

    unsubscribe = ReleaseStore.listen(() => this.onStoreUpdate(), undefined);

    fetchRelease() {
      const {api, organization, projectSlug, releaseVersion} = this.props;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);
      const orgSlug = organization.slug;

      if (
        (!releaseData.release && !releaseData.releaseLoading) ||
        releaseData.releaseError
      ) {
        getProjectRelease(api, {orgSlug, projectSlug, releaseVersion});
      }
    }

    fetchDeploys() {
      const {api, organization, projectSlug, releaseVersion} = this.props;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);
      const orgSlug = organization.slug;

      if (
        (!releaseData.deploys && !releaseData.deploysLoading) ||
        releaseData.deploysError
      ) {
        getReleaseDeploys(api, {orgSlug, projectSlug, releaseVersion});
      }
    }

    onStoreUpdate() {
      const {projectSlug, releaseVersion} = this.props;
      const releaseData = ReleaseStore.get(projectSlug, releaseVersion);

      this.setState({...releaseData});
    }

    render() {
      return (
        <WrappedComponent
          {...(this.props as P & DependentProps)}
          {...(this.state as InjectedProps)}
        />
      );
    }
  }
  return WithRelease;
}

export default withRelease;
