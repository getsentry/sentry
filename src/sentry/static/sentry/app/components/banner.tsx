import {css} from '@emotion/core';
import React from 'react';
import styled from '@emotion/styled';

import {IconClose} from 'app/icons/iconClose';
import {t} from 'app/locale';
import space from 'app/styles/space';

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
      backgroundComponent,
      className,
    } = this.props;

    return (
      <BannerWrapper
        backgroundComponent={backgroundComponent}
        backgroundImg={backgroundImg}
        className={className}
      >
        {backgroundComponent}
        {isDismissable ? (
          <StyledIconClose aria-label={t('Close')} onClick={onCloseClick} />
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
  backgroundComponent?: React.ReactNode;
};

const BannerWrapper = styled('div')<BannerWrapperProps>`
  ${p =>
    p.backgroundImg
      ? css`
          background: url(${p.backgroundImg});
          background-repeat: no-repeat;
          background-size: cover;
          background-position: center center;
        `
      : css`
          background: ${p.theme.gray700};
        `}

  ${p =>
    p.backgroundComponent &&
    css`
      display: flex;
      flex-direction: column;
      overflow: hidden;
    `}
  position: relative;
  margin-bottom: ${space(3)};
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.white};
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

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    padding: ${space(0)};
  }
`;

const BannerTitle = styled('h1')`
  margin-bottom: ${space(0.25)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: 24px;
  }

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    margin-top: ${space(2)};
    margin-bottom: ${space(0.5)};
    font-size: 42px;
  }
`;

const BannerSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeSmall};
  }
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
    margin-bottom: ${space(1)};
    flex-direction: row;
    min-width: 650px;
  }
`;

const BannerActions = styled('div')`
  display: flex;
  justify-content: center;
  width: 100%;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    width: auto;
  }
`;

const StyledIconClose = styled(IconClose)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.white};
  cursor: pointer;
  z-index: 1;
`;

export default Banner;
