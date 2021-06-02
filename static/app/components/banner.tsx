import * as React from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ButtonBar from 'app/components/buttonBar';
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
      <BannerWrapper backgroundImg={backgroundImg} className={className}>
        {backgroundComponent}
        {isDismissable ? (
          <StyledIconClose aria-label={t('Close')} onClick={onCloseClick} />
        ) : null}
        <BannerContent>
          <BannerTitle>{title}</BannerTitle>
          <BannerSubtitle>{subtitle}</BannerSubtitle>
          <StyledButtonBar gap={1}>{children}</StyledButtonBar>
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
          background-color: ${p.theme.gray500};
        `}
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: ${space(2)};
  box-shadow: ${p => p.theme.dropShadowLight};
  border-radius: ${p => p.theme.borderRadius};
  height: 180px;
  color: ${p => p.theme.white};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    height: 220px;
  }
`;

const BannerContent = styled('div')`
  position: absolute;
  display: grid;
  justify-items: center;
  grid-template-rows: repeat(3, max-content);
  text-align: center;
  padding: ${space(4)};
`;

const BannerTitle = styled('h1')`
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    font-size: 40px;
  }
`;

const BannerSubtitle = styled('div')`
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  width: fit-content;
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
