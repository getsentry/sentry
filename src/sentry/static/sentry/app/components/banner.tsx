import React from 'react';
import styled from 'react-emotion';
import theme from 'app/utils/theme';

import spaceBg from '../../images/background-space.svg';

type Props = {
  title?: string;
  subtitle?: string;
};

class Banner extends React.Component<Props> {
  render() {
    const {title, subtitle, children} = this.props;

    return (
      <StyledBanner>
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
  height: 0;
  position: relative;
  min-height: 320px;
  padding-top: 24%;
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
  padding: 48px;
`;

const BannerTitle = styled('h1')`
  margin: 16px 0;
  color: ${p => p.theme.white};
`;

const BannerSubtitle = styled('h5')`
  margin-bottom: 24px;
  color: ${p => p.theme.white};
`;

const BannerActions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: space-between;

  @media (min-width: ${theme.breakpoints[1]}) {
    flex-direction: row;
    min-width: 650px;
  }
`;

export default Banner;
