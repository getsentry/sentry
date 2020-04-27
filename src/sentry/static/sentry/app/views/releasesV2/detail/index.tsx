import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Release, ReleaseProject, Deploy, GlobalSelection} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';
import AsyncComponent from 'app/components/asyncComponent';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import LoadingIndicator from 'app/components/loadingIndicator';
import {IconInfo, IconWarning} from 'app/icons';
import space from 'app/styles/space';
import Alert from 'app/components/alert';

import ReleaseHeader from './releaseHeader';
import PickProjectToContinue from './pickProjectToContinue';

type ReleaseContext = {
  release: Release;
  project: ReleaseProject;
  releaseProjects: ReleaseProject[];
};
const ReleaseContext = React.createContext<ReleaseContext>({} as ReleaseContext);

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
  releaseProjects: ReleaseProject[];
};

type State = {
  release: Release;
  deploys: Deploy[];
} & AsyncView['state'];

class ReleasesV2Detail extends AsyncView<Props, State> {
  shouldReload = true;

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

  handleError(e, args) {
    const {router, location} = this.props;
    const possiblyWrongProject = e.status === 403;

    if (possiblyWrongProject) {
      // refreshing this page without project ID will bring up a project selector
      router.replace({
        ...location,
        query: {...location.query, project: undefined},
      });
      return;
    }
    super.handleError(e, args);
  }

  renderBody() {
    const {organization, location, selection, releaseProjects} = this.props;
    const {release, deploys, reloading} = this.state;
    const project = release?.projects.find(p => p.id === selection.projects[0]);

    if (!project || !release) {
      if (reloading) {
        return <LoadingIndicator />;
      }

      return null;
    }

    return (
      <LightWeightNoProjectMessage organization={organization}>
        <StyledPageContent>
          <ReleaseHeader
            location={location}
            orgId={organization.slug}
            release={release}
            deploys={deploys || []}
            project={project}
          />

          <ContentBox>
            <ReleaseContext.Provider value={{release, project, releaseProjects}}>
              {this.props.children}
            </ReleaseContext.Provider>
          </ContentBox>
        </StyledPageContent>
      </LightWeightNoProjectMessage>
    );
  }
}

class ReleasesV2DetailContainer extends AsyncComponent<Omit<Props, 'releaseProjects'>> {
  shouldReload = true;

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

  renderError(...args) {
    const has404Errors = Object.values(this.state.errors).find(e => e?.status === 404);

    if (has404Errors) {
      // This catches a 404 coming from the release endpoint and displays a custom error message.
      return (
        <PageContent>
          <Alert type="error" icon={<IconWarning />}>
            {t('This release could not be found.')}
          </Alert>
        </PageContent>
      );
    }

    return super.renderError(...args);
  }

  isProjectMissingInUrl() {
    const projectId = this.props.location.query.project;

    return !projectId || typeof projectId !== 'string';
  }

  renderProjectsFooterMessage() {
    return (
      <ProjectsFooterMessage>
        <IconInfo size="xs" /> {t('Only projects with this release are visible.')}
      </ProjectsFooterMessage>
    );
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
      <GlobalSelectionHeader
        lockedMessageSubject={t('release')}
        shouldForceProject={projects.length === 1}
        forceProject={projects.length === 1 ? projects[0] : undefined}
        specificProjectSlugs={projects.map(p => p.slug)}
        disableMultipleProjectSelection
        showProjectSettingsLink
        projectsFooterMessage={this.renderProjectsFooterMessage()}
      >
        <ReleasesV2Detail {...this.props} releaseProjects={projects} />
      </GlobalSelectionHeader>
    );
  }
}

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ProjectsFooterMessage = styled('div')`
  display: grid;
  align-items: center;
  grid-template-columns: min-content 1fr;
  grid-gap: ${space(1)};
`;

const ContentBox = styled('div')`
  padding: ${space(4)};
  flex: 1;
  background-color: white;
`;

export {ReleasesV2DetailContainer, ReleaseContext};
export default withGlobalSelection(withOrganization(ReleasesV2DetailContainer));
