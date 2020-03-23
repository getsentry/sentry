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
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';
import withGlobalSelection from 'app/utils/withGlobalSelection';

import ReleaseHeader from './releaseHeader';

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

const ReleasesV2DetailContainer = (props: Props) => (
  <React.Fragment>
    <GlobalSelectionHeader organization={props.organization} />
    <ReleasesV2Detail {...props} />
  </React.Fragment>
);

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

export {ReleasesV2DetailContainer, ReleaseContext};
export default withGlobalSelection(withOrganization(ReleasesV2DetailContainer));
