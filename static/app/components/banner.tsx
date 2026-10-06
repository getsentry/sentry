import {useState} from 'react';
import {useTheme} from '@emotion/react';

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
    <Flex
      className={className}
      align="center"
      justify="center"
      position="relative"
      overflow="hidden"
      marginBottom="xl"
      radius="md"
      height={{zero: '180px', xl: '220px'}}
      style={{
        backgroundColor: backgroundImg ? undefined : theme.colors.gray800,
        backgroundImage: backgroundImg ? `url(${backgroundImg})` : undefined,
        backgroundPosition: 'center',
        backgroundRepeat: 'no-repeat',
        backgroundSize: 'cover',
        boxShadow: theme.shadow.medium,
        color: theme.colors.white,
      }}
    >
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
    </Flex>
  );
}

Banner.dismiss = dismissBanner;
