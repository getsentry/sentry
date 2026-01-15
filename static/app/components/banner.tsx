import {useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Button, ButtonBar} from 'sentry/components/core/button';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

const makeKey = (prefix: string) => `${prefix}-banner-dismissed`;

function dismissBanner(bannerKey: string) {
  localStorage.setItem(makeKey(bannerKey), 'true');
}

export function useDismissable(bannerKey: string) {
  const key = makeKey(bannerKey);
  const [value, setValue] = useState(localStorage.getItem(key));

  const dismiss = () => {
    setValue('true');
    dismissBanner(bannerKey);
  };

  return [value === 'true', dismiss] as const;
}

type BannerWrapperProps = {
  backgroundComponent?: React.ReactNode;
  backgroundImg?: string;
};

type Props = BannerWrapperProps & {
  children?: React.ReactNode;
  className?: string;
  dismissKey?: string;
  isDismissable?: boolean;
  subtitle?: string;
  title?: string;
};

function Banner({
  title,
  subtitle,
  isDismissable = true,
  dismissKey = 'generic-banner',
  className,
  backgroundImg,
  backgroundComponent,
  children,
}: Props) {
  const [dismissed, dismiss] = useDismissable(dismissKey);

  if (dismissed) {
    return null;
  }

  return (
    <BannerWrapper backgroundImg={backgroundImg} className={className}>
      {backgroundComponent}
      {isDismissable ? (
        <CloseButton
          type="button"
          borderless
          size="xs"
          priority="link"
          icon={<IconClose />}
          onClick={dismiss}
          aria-label={t('Close')}
        />
      ) : null}
      <BannerContent>
        <BannerTitle>{title}</BannerTitle>
        <BannerSubtitle>{subtitle}</BannerSubtitle>
        <StyledButtonBar>{children}</StyledButtonBar>
      </BannerContent>
    </BannerWrapper>
  );
}

Banner.dismiss = dismissBanner;

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
          background-color: ${p.theme.colors.gray800};
        `}
  display: flex;
  overflow: hidden;
  align-items: center;
  justify-content: center;
  position: relative;
  margin-bottom: ${space(2)};
  box-shadow: ${p => p.theme.dropShadowMedium};
  border-radius: ${p => p.theme.radius.md};
  height: 180px;
  color: ${p => p.theme.colors.white};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
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

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: 40px;
  }
`;

const BannerSubtitle = styled('div')`
  margin: 0;

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    font-size: ${p => p.theme.fontSize.xl};
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  margin-top: ${space(2)};
  width: fit-content;
`;

const CloseButton = styled(Button)`
  position: absolute;
  display: block;
  top: ${space(2)};
  right: ${space(2)};
  color: ${p => p.theme.colors.white};
  cursor: pointer;
  z-index: 1;
`;

export default Banner;
