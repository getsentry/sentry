import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import theme from 'app/utils/theme';
import space from 'app/styles/space';
import {t} from 'app/locale';

type Props = {
  title?: string;
  subtitle?: string;
  isDismissable?: boolean;
  onCloseClick?: () => void;
  className?: string;
} & BannerWrapperProps;

class Banner extends React.Component<Props> {
  static defaultProps: Partial<Props> = {
    isDismissable: true,
  };

  render() {
    const {
      title,
      subtitle,
      isDismissable,
      onCloseClick,
      children,
      backgroundImg,
      className,
    } = this.props;

    return (
      <BannerWrapper backgroundImg={backgroundImg} className={className}>
        {isDismissable ? (
          <BannerIcon src="icon-close" aria-label={t('Close')} onClick={onCloseClick} />
        ) : null}
        <BannerContent>
          <BannerTitle>{title}</BannerTitle>
          <BannerSubtitle>{subtitle}</BannerSubtitle>
          <BannerActions>{children}</BannerActions>
        </BannerContent>
      </BannerWrapper>
    );
  }
}

type BannerWrapperProps = {
  backgroundImg?: string;
};

const BannerWrapper = styled('div')<BannerWrapperProps>`
  background: ${p => {
    if (p.backgroundImg) {
      return 'url(' + p.backgroundImg + ')';
    }
    return p.theme.gray700;
  }};
  background-repeat: no-repeat;
  background-size: cover;
  background-position: center center;
  position: relative;
  min-height: 200px;
  margin-bottom: ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};

  @media (min-width: ${theme.breakpoints[1]}) {
    min-height: 220px;
  }

  @media (min-width: ${theme.breakpoints[3]}) {
    min-height: 260px;
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

  @media (max-width: ${theme.breakpoints[0]}) {
    position: relative;
  }
`;

const BannerTitle = styled('h1')`
  margin-bottom: ${space(0.25)};

  @media (min-width: ${theme.breakpoints[1]}) {
    margin-top: ${space(2)};
    margin-bottom: ${space(0.5)};
    font-size: 42px;
  }
`;

const BannerSubtitle = styled('div')`
  font-size: ${theme.fontSizeMedium};

  @media (min-width: ${theme.breakpoints[1]}) {
    font-size: ${theme.fontSizeExtraLarge};
    margin-bottom: ${space(1)};
    flex-direction: row;
    min-width: 650px;
  }
`;

const BannerActions = styled('div')`
  display: flex;
  justify-content: center;
  width: 100%;

  @media (min-width: ${theme.breakpoints[1]}) {
    width: auto;
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
