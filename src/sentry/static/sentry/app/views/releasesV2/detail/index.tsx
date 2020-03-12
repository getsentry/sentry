import React from 'react';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Release, Deploy, Project} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent} from 'app/styles/organization';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';

import ReleaseHeader from './releaseHeader';

const ReleaseContext = React.createContext<Release | undefined>(undefined);

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
  project: Project;
} & AsyncView['props'];

type State = {
  release: Release;
  deploys: Deploy[];
} & AsyncView['state'];

// TODO(releasesv2): Handle project selection
class ReleasesV2Detail extends AsyncView<Props, State> {
  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(
      t('Release %s', formatVersion(params.release)),
      organization.slug,
      false
    );
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, location, params, project} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
      health: 1,
    };

    return [
      [
        'deploys',
        `/organizations/${organization.slug}/releases/${encodeURIComponent(
          params.release
        )}/deploys/`,
      ],
      [
        'release',
        `/projects/${organization.slug}/${project.slug}/releases/${encodeURIComponent(
          params.release
        )}/`,
        {query},
      ],
    ];
  }

  renderError(error: Error, disableLog = false, disableReport = false) {
    const {errors} = this.state;
    const has404Errors = Object.values(errors).find(e => e?.status === 404);

    if (has404Errors) {
      return (
        <PageContent>
          <Alert type="error" icon="icon-circle-exclamation">
            {t('This release may not be in your selected project')}
          </Alert>
        </PageContent>
      );
    }

    return super.renderError(error, disableLog, disableReport);
  }

  renderBody() {
    const {organization, location} = this.props;
    const {release, deploys} = this.state;

    return (
      <NoProjectMessage organization={organization}>
        <StyledPageContent>
          <ReleaseHeader
            location={location}
            orgId={organization.slug}
            release={release}
            deploys={deploys}
          />

          <ReleaseContext.Provider value={release}>
            {this.props.children}
          </ReleaseContext.Provider>
        </StyledPageContent>
      </NoProjectMessage>
    );
  }
}

const ReleasesV2DetailContainer = (props: Omit<Props, 'project'>) => {
  const {organization, location} = props;
  const project = organization.projects.find(p => p.id === location.query.project);

  if (!project) {
    return null;
  }

  return (
    <React.Fragment>
      <GlobalSelectionHeader organization={props.organization} />
      <ReleasesV2Detail {...props} project={project} />
    </React.Fragment>
  );
};

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export {ReleasesV2DetailContainer, ReleaseContext};
export default withOrganization(ReleasesV2DetailContainer);
