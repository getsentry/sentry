import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Grid} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

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
  subtitle?: string;
  title?: string;
};

export function Banner({
  title,
  subtitle,
  dismissKey = 'generic-banner',
  className,
  backgroundImg,
  backgroundComponent,
  children,
}: Props) {
  const [dismissed, dismiss] = useDismissable(dismissKey);
  const theme = useTheme();

  if (dismissed) {
    return null;
  }

  return (
    <BannerWrapper backgroundImg={backgroundImg} className={className}>
      {backgroundComponent}
      <Grid
        position="absolute"
        justifyItems="center"
        rows="repeat(3, max-content)"
        padding="3xl"
      >
        <Heading as="h1" align="center" size={{zero: '2xl', xl: '4xl'}} variant="inherit">
          {title}
        </Heading>
        <Text as="div" align="center" size={{zero: 'md', xl: 'xl'}} variant="inherit">
          {subtitle}
        </Text>
        <Grid flow="column" align="center" gap="md" width="fit-content" paddingTop="xl">
          {children}
        </Grid>
      </Grid>
      <Container position="absolute" top={theme.space.xl} right={theme.space.xl}>
        <Button
          size="xs"
          variant="link"
          icon={<IconClose />}
          onClick={dismiss}
          aria-label={t('Close')}
          style={{color: theme.colors.white}}
        />
      </Container>
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
  margin-bottom: ${p => p.theme.space.xl};
  box-shadow: ${p => p.theme.shadow.medium};
  border-radius: ${p => p.theme.radius.md};
  height: 180px;
  color: ${p => p.theme.colors.white};
  container-type: inline-size;

  @container (min-width: ${p => p.theme.container.xl}) {
    height: 220px;
  }
`;
