import {Component} from 'react';

import {getProjectRelease, getReleaseDeploys} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import ReleaseStore from 'sentry/stores/releaseStore';
import {Deploy, Organization, Release} from 'sentry/types';
import getDisplayName from 'sentry/utils/getDisplayName';

type DependentProps = {
  api: Client;
  organization: Organization;
  projectSlug: string;
  releaseVersion: string;
};

type InjectedProps = {
  deploys?: Array<Deploy>;
  deploysError?: Error;
  deploysLoading?: boolean;
  release?: Release;
  releaseError?: Error;
  releaseLoading?: boolean;
};

function withRelease<P extends DependentProps>(WrappedComponent: React.ComponentType<P>) {
  class WithRelease extends Component<
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
