import React from 'react';
import InlineSvg from 'app/components/inlineSvg';

import styled from 'react-emotion';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {t} from 'app/locale';

import spaceBg from '../../images/background-space.svg';

type Props = {
  title?: string;
  subtitle?: string;
  isDismissable?: boolean;
  onCloseClick?: () => void;
};

class Banner extends React.Component<Props> {
  static defaultProps: Partial<Props> = {
    isDismissable: true,
  };

  render() {
    const {title, subtitle, isDismissable, onCloseClick, children} = this.props;

    return (
      <StyledBanner>
        {isDismissable ? (
          <BannerIcon src="icon-close" aria-label={t('Close')} onClick={onCloseClick} />
        ) : null}
        <BannerContent>
          <BannerTitle>{title}</BannerTitle>
          <BannerSubtitle>{subtitle}</BannerSubtitle>
          <BannerActions>{children}</BannerActions>
        </BannerContent>
      </StyledBanner>
    );
  }
}

const StyledBanner = styled('div')`
  background-image: url(${spaceBg});
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center center;
  position: relative;
  min-height: 320px;
  padding-top: 24%;
  box-shadow: ${p => p.theme.dropShadowLight};
  margin-bottom: ${space(3)};

  @media (min-width: ${theme.breakpoints[1]}) {
    min-height: 220px;
  }

  @media (min-width: ${theme.breakpoints[3]}) {
    padding-top: 0;
    height: 300px;
  }
`;

const BannerContent = styled('div')`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
  padding: ${space(4)};
`;

const BannerTitle = styled('h1')`
  margin: ${space(1.5)};
  color: ${p => p.theme.white};

  @media (min-width: ${theme.breakpoints[1]}) {
    font-size: 48px;
  }
`;

const BannerSubtitle = styled('h4')`
  margin-bottom: ${space(3)};
  font-size: ${theme.fontSizeMedium};
  color: ${p => p.theme.white};

  @media (min-width: ${theme.breakpoints[1]}) {
    font-size: ${theme.fontSizeLarge};
    flex-direction: row;
    min-width: 650px;
  }
`;

const BannerActions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  width: 100%;

  @media (min-width: ${theme.breakpoints[1]}) {
    width: auto;
    flex-direction: row;
    min-width: 650px;
  }
`;

const BannerIcon = styled(InlineSvg)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

export default Banner;
