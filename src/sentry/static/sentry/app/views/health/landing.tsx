import React from 'react';
import PropTypes from 'prop-types';
import styled from 'react-emotion';
import * as ReactRouter from 'react-router';
import {Params} from 'react-router/lib/Router';
import {Location} from 'history';

import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {Organization} from 'app/types';
import localStorage from 'app/utils/localStorage';
import AsyncComponent from 'app/components/asyncComponent';
import SentryDocumentTitle from 'app/components/sentryDocumentTitle';
import GlobalSelectionHeader from 'app/components/organizations/globalSelectionHeader';
import Banner from 'app/components/banner';
import NoProjectMessage from 'app/components/noProjectMessage';
import {PageContent} from 'app/styles/organization';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

const BANNER_DISMISSED_KEY = 'health-banner-dismissed';

function checkIsBannerHidden(): boolean {
  return localStorage.getItem(BANNER_DISMISSED_KEY) === 'true';
}

type Props = {
  organization: Organization;
  location: Location;
  router: ReactRouter.InjectedRouter;
  params: Params;
} & AsyncComponent['props'];

type State = {
  isBannerHidden: boolean;
} & AsyncComponent['state'];

class HealthLanding extends AsyncComponent<Props, State> {
  static propTypes: any = {
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    router: PropTypes.object.isRequired,
  };

  state: State = {
    // AsyncComponent state
    loading: true,
    reloading: false,
    error: false,
    errors: [],

    // local component state
    isBannerHidden: checkIsBannerHidden(),
  };

  shouldReload = true;

  componentDidUpdate() {
    const isBannerHidden = checkIsBannerHidden();
    if (isBannerHidden !== this.state.isBannerHidden) {
      // eslint-disable-next-line react/no-did-update-set-state
      this.setState({
        isBannerHidden,
      });
    }
  }

  handleClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  renderBanner() {
    const bannerDismissed = this.state.isBannerHidden;

    if (bannerDismissed) {
      return null;
    }

    return (
      <Banner
        title={t('Health')}
        subtitle={t('Monitoring the health of your application')}
        onCloseClick={this.handleClick}
      />
    );
  }

  render() {
    let body;
    const {organization} = this.props;
    const {loading, error} = this.state;
    if (loading) {
      body = this.renderLoading();
    } else if (error) {
      body = this.renderError();
    } else {
      body = (
        <PageContent>
          <StyledPageHeader>{t('Health')}</StyledPageHeader>
          {this.renderBanner()}

          <StyledGrid>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
            <p>
              Lorem ipsum dolor sit amet consectetur adipisicing elit. Vel neque nostrum
              repellendus non optio. Est consectetur, amet excepturi delectus animi soluta
              reprehenderit repellendus nostrum veniam? Odio incidunt consequatur
              necessitatibus ea.
            </p>
          </StyledGrid>
        </PageContent>
      );
    }

    return (
      <SentryDocumentTitle title={t('Health')} objSlug={organization.slug}>
        <React.Fragment>
          <GlobalSelectionHeader organization={organization} />
          <NoProjectMessage organization={organization}>{body}</NoProjectMessage>
        </React.Fragment>
      </SentryDocumentTitle>
    );
  }
}

const StyledPageHeader = styled('div')`
  display: flex;
  align-items: center;
  font-size: ${p => p.theme.headerFontSize};
  color: ${p => p.theme.gray4};
  height: 40px;
  margin-bottom: ${space(1)};
`;

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
