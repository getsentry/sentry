import {useTheme} from '@emotion/react';

import sizeAnalysisPreview from 'sentry-images/spot/releases-tour-commits.svg';

import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Image} from 'sentry/components/core/image';
import {Container, Flex} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import List from 'sentry/components/list';
import ListItem from 'sentry/components/list/listItem';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {t} from 'sentry/locale';
import type {PlatformKey} from 'sentry/types/project';

interface PreprodOnboardingProps {
  organizationSlug: string;
  projectPlatform: PlatformKey | null;
  projectSlug: string;
}

type SupportedPlatform = 'ios' | 'android' | 'flutter' | 'react-native';

const PRODUCT_DOC_URL = 'https://docs.sentry.io/product/size-analysis/';

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

export function PreprodOnboarding(props: PreprodOnboardingProps) {
  const {projectPlatform} = props;
  const theme = useTheme();

  const platformDoc = PLATFORM_DOCS.find(doc => doc.matches(projectPlatform));

  return (
    <Panel>
      <PanelBody>
        <Flex justify="between" align="start" width="100%" padding="3xl" gap="xl">
          <Container flex={1}>
            <Heading as="h1" size="2xl">
              {t('Upload Mobile Builds to Sentry')}
            </Heading>
            <Text as="p" size="md" style={{marginBottom: theme.space.md}}>
              {t('Monitor & reduce your app size and distribute pre-release builds')}
            </Text>
            <List symbol="bullet">
              <ListItem>
                {t('Get automated checks size regressions and distributable builds')}
              </ListItem>
              <ListItem>
                {t('See actionable insights on how to reduce your app size')}
              </ListItem>
              <ListItem>{t('Distribute pre-release builds to your team')}</ListItem>
            </List>
            <Flex gap="md" wrap="wrap" marginTop="lg">
              <LinkButton href={PRODUCT_DOC_URL} external priority="primary" size="md">
                {t('Product Docs')}
              </LinkButton>
              {platformDoc ? (
                <LinkButton href={platformDoc.url} external size="md">
                  {platformDoc.buttonLabel}
                </LinkButton>
              ) : null}
            </Flex>
          </Container>
          <Container display={{xs: 'none', md: 'block'}}>
            <Image
              src={sizeAnalysisPreview}
              alt={t('Size analysis illustration')}
              height="120px"
              style={{pointerEvents: 'none', overflow: 'hidden'}}
            />
          </Container>
        </Flex>
      </PanelBody>
    </Panel>
  );
}
