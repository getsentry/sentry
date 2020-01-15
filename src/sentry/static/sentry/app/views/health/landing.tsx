import React from 'react';
import styled from '@emotion/styled';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import AsyncView from 'app/views/asyncView';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Banner from 'app/components/banner';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent, PageHeader} from 'app/styles/organization';
import PageHeading from 'app/components/pageHeading';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';
import GlobalSelectionLink from 'app/components/globalSelectionLink';
import LoadingIndicator from 'app/components/loadingIndicator';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import routeTitleGen from 'app/utils/routeTitle';

const BANNER_DISMISSED_KEY = 'health-banner-dismissed';

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
} & AsyncView['props'];

type State = {
  isBannerHidden: boolean;
} & AsyncView['state'];

class HealthLanding extends AsyncView<Props, State> {
  getTitle() {
    return routeTitleGen(t('Health'), this.props.organization.slug, false);
  }

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      isBannerHidden: localStorage.getItem(BANNER_DISMISSED_KEY) === 'true',
    };
  }

  getEndpoints(): [string, string][] {
    return [['dummy', '/organizations/sentry/projects/']];
  }

  handleBannerCloseClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  renderLoading() {
    return this.renderBody();
  }

  renderEmpty() {
    return (
      <EmptyStateWarning small>
        {t('There are no dummy health something.')}
      </EmptyStateWarning>
    );
  }

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    return (
      <Banner
        title={t('Health')}
        subtitle={t('Monitoring the health of your application')}
        onCloseClick={this.handleBannerCloseClick}
      />
    );
  }

  renderInnerBody() {
    const {organization} = this.props;
    const {loading, dummy} = this.state;

    if (loading) {
      return <LoadingIndicator />;
    }

    if (!dummy.length) {
      return this.renderEmpty();
    }

    return (
      <React.Fragment>
        {this.renderBanner()}

        <StyledGrid>
          {[1, 2, 3, 4].map(number => (
            <div key={number}>
              <GlobalSelectionLink
                to={`/organizations/${organization.slug}/health/${number}/`}
              >
                Dummy
              </GlobalSelectionLink>
              <p>
                Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
                repellendus non optio. Est consectetur, amet excepturi delectus animi
                soluta reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
                necessitatibus ea.
              </p>
            </div>
          ))}
        </StyledGrid>
      </React.Fragment>
    );
  }

  renderBody() {
    const {organization} = this.props;

    return (
      <React.Fragment>
        <GlobalSelectionHeader organization={organization} />

        <NoProjectMessage organization={organization}>
          <PageContent>
            <PageHeader>
              <PageHeading withMargins>{t('Health')}</PageHeading>
            </PageHeader>

            {this.renderInnerBody()}
          </PageContent>
        </NoProjectMessage>
      </React.Fragment>
    );
  }
}

const StyledGrid = styled('div')`
  display: grid;
  grid-template-columns: minmax(100px, 1fr);
  grid-gap: ${space(3)};

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    grid-template-columns: repeat(2, minmax(100px, 1fr));
  }

  @media (min-width: ${p => p.theme.breakpoints[2]}) {
    grid-template-columns: repeat(3, minmax(100px, 1fr));
  }
`;

export default withOrganization(HealthLanding);
export {HealthLanding};
