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
  background-size: 100% auto;
  height: 0;
  position: relative;
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
  padding: 40px;
`;

const BannerTitle = styled('h1')`
  margin-bottom: 8px;
  color: ${p => p.theme.white};
`;
const BannerSubtitle = styled('h5')`
  margin-bottom: 24px;
  color: ${p => p.theme.white};
`;

const BannerActions = styled('div')`
  width: 60%;
  min-width: 650px;
  display: flex;
  flex-direction: row;
  justify-content: space-between;

  @media (max-width: ${theme.breakpoints[1]}) {
    flex-direction: column;
  }
`;

export default Banner;
