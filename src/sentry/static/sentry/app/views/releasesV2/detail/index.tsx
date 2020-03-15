import React from 'react';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization, Release, Deploy} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent} from 'app/styles/organization';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {formatVersion} from 'app/utils/formatters';
import {openModal} from 'app/actionCreators/modal';
import ContextPickerModal from 'app/components/contextPickerModal';
import {addErrorMessage} from 'app/actionCreators/indicator';

import ReleaseHeader from './releaseHeader';

const ReleaseContext = React.createContext<Release | undefined>(undefined);

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
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

  renderError() {
    const {errors} = this.state;
    const {router, location} = this.props;
    const possiblyWrongProject = Object.values(errors).find(
      e => e?.status === 404 || e?.status === 403
    );

    if (possiblyWrongProject) {
      addErrorMessage(t('This release may not be in your selected project.'));
      // refreshing this page without project ID will bring up a project selector
      router.replace({
        ...location,
        query: {...location.query, project: undefined},
      });
    }

    return null;
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

const ReleasesV2DetailContainer = (props: Props) => {
  const {organization, location, router, params} = props;

  const projectId = location.query.project;

  // if there is no project in url, present a project selector
  if (!projectId || typeof projectId !== 'string') {
    openModal(
      ({Header, Body}) => (
        <ContextPickerModal
          Header={Header}
          Body={Body}
          needOrg={false}
          needProject
          nextPath={`/organizations/${organization.slug}/releases-v2/${encodeURIComponent(
            params.release
          )}/?project=:project`}
          onFinish={pathname => {
            router.replace(pathname);
          }}
        />
      ),
      {
        onClose() {
          // if a user closes the modal (either via button, Ecs, clicking outside)
          router.push(`/organizations/${organization.slug}/releases-v2/`);
        },
      }
    );

    return <ContextPickerBackground />;
  }

  // otherwhise business as usual
  return (
    <React.Fragment>
      <GlobalSelectionHeader
        organization={organization}
        shouldForceProject
        lockedMessageSubject={t('release')}
        forceProject={organization.projects.find(p => p.id === projectId)}
      />
      <ReleasesV2Detail {...props} />
    </React.Fragment>
  );
};

const StyledPageContent = styled(PageContent)`
  padding: 0;
`;

const ContextPickerBackground = styled('div')`
  height: 100vh;
  width: 100%;
`;

export {ReleasesV2DetailContainer, ReleaseContext};
export default withOrganization(ReleasesV2DetailContainer);
