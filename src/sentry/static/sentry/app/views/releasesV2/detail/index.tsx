import React from 'react';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';
import pick from 'lodash/pick';
import styled from '@emotion/styled';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent} from 'app/styles/organization';
import Alert from 'app/components/alert';
import withOrganization from 'app/utils/withOrganization';
import routeTitleGen from 'app/utils/routeTitle';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';

import ReleaseHeader from './releaseHeader';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
} & AsyncView['props'];

type State = {} & AsyncView['state'];

// TODO(releasesv2): Handle project selection
class ReleasesV2Detail extends AsyncView<Props, State> {
  getTitle() {
    const {params, organization} = this.props;
    return routeTitleGen(t('Release %s', params.release), organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
    };
  }

  getEndpoints(): [string, string, {}][] {
    const {organization, location, params} = this.props;

    const query = {
      ...pick(location.query, [...Object.values(URL_PARAM)]),
    };

    const basePath = `/organizations/${organization.slug}/releases/${encodeURIComponent(
      params.release
    )}/`;

    return [
      ['release', basePath, {query}],
      ['deploys', `${basePath}deploys/`, {}],
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

          {this.props.children}
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

export default withOrganization(ReleasesV2DetailContainer);
