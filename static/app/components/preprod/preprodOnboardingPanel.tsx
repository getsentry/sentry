import {useTheme} from '@emotion/react';

import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

type SupportedPlatform = 'ios' | 'android' | 'flutter' | 'react-native';

const PRODUCT_DOC_URL = 'https://docs.sentry.io/product/size-analysis/';
const PREPROD_ONBOARDING_ARCADE_URL =
  'https://demo.arcade.software/llDAtVroCp4jCvnPj5qu?embed';

const PLATFORM_DOCS: Array<{
  buttonLabel: string;
  id: SupportedPlatform;
  matches: (platform: PlatformKey | null) => boolean;
  url: string;
}> = [
  {
    id: 'ios',
    buttonLabel: t('iOS Docs'),
    url: 'https://docs.sentry.io/platforms/apple/guides/ios/size-analysis/',
    matches: platform =>
      platform?.includes('apple') || platform?.includes('ios') || platform === 'cocoa',
  },
  {
    id: 'android',
    buttonLabel: t('Android Docs'),
    url: 'https://docs.sentry.io/platforms/android/size-analysis/',
    matches: platform => platform?.includes('android') ?? false,
  },
  {
    id: 'flutter',
    buttonLabel: t('Flutter Docs'),
    url: 'https://docs.sentry.io/platforms/dart/guides/flutter/size-analysis/',
    matches: platform => platform?.includes('flutter') ?? false,
  },
  {
    id: 'react-native',
    buttonLabel: t('React Native Docs'),
    url: 'https://docs.sentry.io/platforms/react-native/size-analysis/',
    matches: platform => platform?.includes('react-native') ?? false,
  },
];

type Props = {
  platform: PlatformKey | null;
  onDocsClick?: (linkType: 'product' | SupportedPlatform) => void;
};

export function PreprodOnboardingPanel({platform, onDocsClick}: Props) {
  const theme = useTheme();
  const platformDoc = PLATFORM_DOCS.find(doc => doc.matches(platform));

  return (
    <Panel>
      <PanelBody>
        <Flex align="start" width="100%" padding="3xl" gap="xl">
          <Container flex={1} minWidth={0}>
            <Heading as="h1" size="2xl">
              {t('Upload Mobile Builds to Sentry')}
            </Heading>
            <Text as="p" size="md" style={{marginBottom: theme.space.md}}>
              {t('Monitor & reduce your app size and distribute pre-release builds')}
            </Text>
            <List symbol="bullet">
              <ListItem>
                {t('Get automated checks on size regressions and distributable builds')}
              </ListItem>
              <ListItem>
                {t('See actionable insights on how to reduce your app size')}
              </ListItem>
              <ListItem>{t('Distribute pre-release builds to your team')}</ListItem>
            </List>
            <Flex gap="md" wrap="wrap" marginTop="lg">
              <LinkButton
                href={PRODUCT_DOC_URL}
                external
                priority="primary"
                size="md"
                onClick={() => onDocsClick?.('product')}
              >
                {t('Product Docs')}
              </LinkButton>
              {platformDoc ? (
                <LinkButton
                  href={platformDoc.url}
                  external
                  size="md"
                  onClick={() => onDocsClick?.(platformDoc.id)}
                >
                  {platformDoc.buttonLabel}
                </LinkButton>
              ) : null}
            </Flex>
          </Container>
          <Container
            display={{xs: 'none', md: 'block'}}
            flex={1}
            minWidth={0}
            borderLeft="muted"
            paddingLeft="xl"
          >
            <iframe
              title={t('Pre-release build walkthrough')}
              src={PREPROD_ONBOARDING_ARCADE_URL}
              loading="lazy"
              allowFullScreen
              style={{
                width: '100%',
                height: '360px',
                border: 0,
                colorScheme: 'auto',
              }}
            />
          </Container>
        </Flex>
      </PanelBody>
    </Panel>
  );
}
