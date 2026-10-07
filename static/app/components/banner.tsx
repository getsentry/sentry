import {useState} from 'react';
import {css, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
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

const BannerFlex = styled(Flex, {
  shouldForwardProp: prop => prop !== 'backgroundImg',
})<{backgroundImg?: string}>`
  background-color: ${p => (p.backgroundImg ? 'transparent' : p.theme.colors.gray800)};
  background-image: ${p => (p.backgroundImg ? `url(${p.backgroundImg})` : 'none')};
  background-position: center;
  background-repeat: no-repeat;
  background-size: cover;
  box-shadow: ${p => p.theme.shadow.medium};
  color: ${p => p.theme.tokens.content.onVibrant.light};
`;

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
    <Container position="relative" marginBottom="xl">
      <BannerFlex
        className={className}
        backgroundImg={backgroundImg}
        align="center"
        justify="center"
        position="relative"
        overflow="hidden"
        radius="md"
        height={{zero: '180px', xl: '220px'}}
      >
        {backgroundComponent}
        <Grid
          position="absolute"
          justifyItems="center"
          rows="repeat(3, max-content)"
          padding="3xl"
        >
          <Heading
            as="h1"
            align="center"
            size={{zero: '2xl', '4xl': '3xl'}}
            variant="inherit"
          >
            {title}
          </Heading>
          <Text
            as="div"
            align="center"
            size={{zero: 'md', '4xl': 'lg'}}
            variant="inherit"
          >
            {subtitle}
          </Text>
          <Grid flow="column" align="center" gap="md" width="fit-content" paddingTop="xl">
            {children}
          </Grid>
        </Grid>
      </BannerFlex>
      <Button
        size="zero"
        icon={<IconClose />}
        onClick={dismiss}
        aria-label={t('Close')}
        css={css`
          position: absolute;
          top: -${theme.space.md};
          right: -${theme.space.md};
          border-radius: 50%;
          z-index: 1;
        `}
      />
    </Container>
  );
}

Banner.dismiss = dismissBanner;
