import React from 'react';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Release, ReleaseProject, Deploy, GlobalSelection} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';
import AsyncComponent from 'app/components/asyncComponent';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import ReleaseHeader from './releaseHeader';
import PickProjectToContinue from './pickProjectToContinue';

type ReleaseContext = {release: Release; project: ReleaseProject};
const ReleaseContext = React.createContext<ReleaseContext>({} as ReleaseContext);

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
  selection: GlobalSelection;
} & AsyncView['props'];

type State = {
  release: Release;
  deploys: Deploy[];
} & AsyncView['state'];

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
    const {organization, location, params} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
      // TODO(releasesV2): summaryStatsPeriod + healthStatsPeriod?
      health: 1,
    };

    const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
      params.release
    )}/`;

    return [
      ['release', basePath, {query}],
      ['deploys', `${basePath}deploys/`],
    ];
  }

  handleError(e) {
    const {router, location} = this.props;
    const possiblyWrongProject = e.status === 404 || e.status === 403;

    if (possiblyWrongProject) {
      // refreshing this page without project ID will bring up a project selector
      router.replace({
        ...location,
        query: {...location.query, project: undefined},
      });
    }
  }

  renderBody() {
    const {organization, location, selection} = this.props;
    const {release, deploys} = this.state;
    const project = release.projects.find(p => p.id === selection.projects[0]);

    // TODO(releasesv2): This will be handled later with forced project selector
    if (!project || !release) {
      return null;
    }

    return (
      <NoProjectMessage organization={organization}>
        <StyledPageContent>
          <ReleaseHeader
            location={location}
            orgId={organization.slug}
            release={release}
            deploys={deploys}
            project={project}
          />

          <ReleaseContext.Provider value={{release, project}}>
            {this.props.children}
          </ReleaseContext.Provider>
        </StyledPageContent>
      </NoProjectMessage>
    );
  }
}

class ReleasesV2DetailContainer extends AsyncComponent<Props> {
  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, params} = this.props;
    // fetch projects this release belongs to
    return [
      [
        'release',
        `/organizations/${organization.slug}/releases/${encodeURIComponent(
          params.release
        )}/`,
      ],
    ];
  }

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;

    return !projectId || typeof projectId !== 'string';
  }

  renderBody() {
    const {organization, params, router} = this.props;
    const {projects} = this.state.release;

    if (this.isProjectMissingInUrl()) {
      return (
        <PickProjectToContinue
          orgSlug={organization.slug}
          version={params.release}
          router={router}
          projects={projects}
        />
      );
    }

    return (
      <React.Fragment>
        <GlobalSelectionHeader
          organization={organization}
          lockedMessageSubject={t('release')}
          shouldForceProject={projects.length === 1}
          forceProject={projects.length === 1 ? projects[0] : undefined}
          projectSlugs={projects.map(p => p.slug)}
          disableMultipleProjectSelection
        />
        <ReleasesV2Detail {...this.props} />
      </React.Fragment>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export {ReleasesV2DetailContainer, ReleaseContext};
export default withGlobalSelection(withOrganization(ReleasesV2DetailContainer));
