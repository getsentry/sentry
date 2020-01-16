import React from 'react';

import {t} from 'app/locale';
import Banner from 'app/components/banner';
import localStorage from 'app/utils/localStorage';

const BANNER_DISMISSED_KEY = 'health-banner-dismissed';

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
      <Banner
        title={t('Health')}
        subtitle={t('Monitoring the health of your application')}
        onCloseClick={this.handleBannerCloseClick}
      />
    );
  }
}

export default IntroBanner;
