import React from 'react';

import {t} from 'app/locale';
import styled from '@emotion/styled';
import theme from 'app/utils/theme';
import Banner from 'app/components/banner';
import localStorage from 'app/utils/localStorage';

const BANNER_DISMISSED_KEY = 'releases-v2-banner-dismissed';

type State = {
  isBannerHidden: boolean;
};

class IntroBanner extends React.Component<{}, State> {
  state = {
    isBannerHidden: localStorage.getItem(BANNER_DISMISSED_KEY) === 'true',
  };

  handleBannerCloseClick = () => {
    localStorage.setItem(BANNER_DISMISSED_KEY, 'true');
    this.setState({isBannerHidden: true});
  };

  render() {
    if (this.state.isBannerHidden) {
      return null;
    }

    return (
      // TODO(releasesv2): change to proper thing once finished
      <Banner title={t('Releases v2')} onCloseClick={this.handleBannerCloseClick}>
        <TemporaryText>
          This is an experimental UI page with dummy data not intended for public usage.
          <br />
          We’re using it for iterating towards the Releases v2 (mobile health)
          deliverable.
        </TemporaryText>
      </Banner>
    );
  }
}

const TemporaryText = styled('h4')`
  color: ${theme.white};
  font-size: ${theme.fontSizeLarge};
`;

export default IntroBanner;
