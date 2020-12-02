import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import pick from 'lodash/pick';

import Alert from 'app/components/alert';
import AsyncComponent from 'app/components/asyncComponent';
import LightWeightNoProjectMessage from 'app/components/lightWeightNoProjectMessage';
import LoadingIndicator from 'app/components/loadingIndicator';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {IconInfo, IconWarning} from 'app/icons';
import {t} from 'app/locale';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import {
  Deploy,
  GlobalSelection,
  Organization,
  ReleaseMeta,
  ReleaseProject,
  ReleaseWithHealth,
} from 'app/types';
import {formatVersion} from 'app/utils/formatters';
import routeTitleGen from 'app/utils/routeTitle';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';
import AsyncView from 'app/views/asyncView';

import PickProjectToContinue from './pickProjectToContinue';
import ReleaseHeader from './releaseHeader';
import {getReleaseEventView} from './utils';

type ReleaseContext = {
  release: ReleaseWithHealth;
  project: Required<ReleaseProject>;
  deploys: Deploy[];
  releaseMeta: ReleaseMeta;
  refetchData: () => void;
};
const ReleaseContext = React.createContext<ReleaseContext>({} as ReleaseContext);

type RouteParams = {
  orgId: string;
  release: string;
};

type Props = RouteComponentProps<RouteParams, {}> & {
  organization: Organization;
  selection: GlobalSelection;
  releaseMeta: ReleaseMeta;
};

type State = {
  release: ReleaseWithHealth;
  deploys: Deploy[];
} & AsyncView['state'];

class ReleasesDetail extends AsyncView<Props, State> {
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
      deploys: [],
    };
  }

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location, params, releaseMeta} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
      health: 1,
    };

    const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
      params.release
    )}/`;

    const endpoints: ReturnType<AsyncView['getEndpoints']> = [
      ['release', basePath, {query}],
    ];

    if (releaseMeta.deployCount > 0) {
      endpoints.push(['deploys', `${basePath}deploys/`]);
    }

    return endpoints;
  }

  renderError(...args) {
    const possiblyWrongProject = Object.values(this.state.errors).find(
      e => e?.status === 404 || e?.status === 403
    );

    if (possiblyWrongProject) {
      return (
        <PageContent>
          <Alert type="error" icon={<IconWarning />}>
            {t('This release may not be in your selected project.')}
          </Alert>
        </PageContent>
      );
    }

    return super.renderError(...args);
  }

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
  }

  renderBody() {
    const {organization, location, selection, releaseMeta} = this.props;
    const {release, deploys, reloading} = this.state;
    const project = release?.projects.find(p => p.id === selection.projects[0]);
    const releaseEventView = getReleaseEventView(
      selection,
      release?.version,
      organization
    );

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
            organization={organization}
            releaseEventView={releaseEventView}
            release={release}
            project={project}
            releaseMeta={releaseMeta}
            refetchData={this.fetchData}
          />
          <ReleaseContext.Provider
            value={{
              release,
              project,
              deploys,
              releaseMeta,
              refetchData: this.fetchData,
            }}
          >
            {this.props.children}
          </ReleaseContext.Provider>
        </StyledPageContent>
      </LightWeightNoProjectMessage>
    );
  }
}

class ReleasesDetailContainer extends AsyncComponent<Omit<Props, 'releaseMeta'>> {
  shouldReload = true;

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, params} = this.props;
    // fetch projects this release belongs to
    return [
      [
        'releaseMeta',
        `/organizations/${organization.slug}/releases/${encodeURIComponent(
          params.release
        )}/meta/`,
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

  renderLoading() {
    return (
      <PageContent>
        <LoadingIndicator />
      </PageContent>
    );
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
    const {releaseMeta} = this.state;
    const {projects} = releaseMeta;

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

    let defaultSelection = {};
    if (organization.features.includes('release-performance-views')) {
      const releaseDate = new Date(releaseMeta.released);
      // Center the release in a 24h time period
      defaultSelection = {
        datetime: {
          start: new Date(releaseDate.getTime() - 12 * 3600 * 1000),
          end: new Date(releaseDate.getTime() + 12 * 3600 * 1000),
          utc: false,
        },
      };
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
        defaultSelection={defaultSelection}
      >
        <ReleasesDetail {...this.props} releaseMeta={releaseMeta} />
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

export {ReleaseContext, ReleasesDetailContainer};
export default withGlobalSelection(withOrganization(ReleasesDetailContainer));
