import styled from '@emotion/styled';

import addIntegrationProvider from 'sentry-images/spot/add-integration-provider.svg';

import {Button, LinkButton} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';

interface AddIntegrationBannerProps {
  onDismiss: () => void;
  orgSlug: string;
}

/**
 * Displayed when there are no installed source integrations (github/gitlab/etc)
 */
export function AddIntegrationBanner({orgSlug, onDismiss}: AddIntegrationBannerProps) {
  return (
    <Banner>
      <Container>
        <Container marginBottom="md">
          <Text as="div" bold size="xl">
            {t('Connect with Git Providers')}
          </Text>
        </Container>
        <Container marginBottom="lg" maxWidth="340px">
          <Text as="div">
            {t(
              'Install Git providers (GitHub, GitLab…) to enable features like code mapping and stack trace linking.'
            )}
          </Text>
        </Container>
        <LinkButton
          to={{
            pathname: `/settings/${orgSlug}/integrations/`,
            // This should filter to only source code management integrations
            query: {category: 'source code management'},
          }}
          size="sm"
        >
          {t('Get Started')}
        </LinkButton>
      </Container>
      <Container
        bottom="0"
        display={{zero: 'none', xl: 'block'}}
        pointerEvents="none"
        position="absolute"
        right="4rem"
      >
        <BannerImage src={addIntegrationProvider} />
      </Container>
      <Flex
        align="start"
        inset="0"
        justify="end"
        padding="xl"
        pointerEvents="none"
        position="absolute"
      >
        <Container pointerEvents="auto">
          <Button
            variant="link"
            aria-label={t('Dismiss')}
            icon={<IconClose variant="muted" />}
            size="xs"
            onClick={onDismiss}
          />
        </Container>
      </Flex>
    </Banner>
  );
}

function Banner({children}: {children: React.ReactNode}) {
  return (
    <Container
      border="primary"
      margin="md 0"
      padding="xl"
      position="relative"
      radius="md"
    >
      {({className}) => <StyledBanner className={className}>{children}</StyledBanner>}
    </Container>
  );
}

const StyledBanner = styled('div')`
  background: linear-gradient(
    90deg,
    color-mix(in srgb, ${p => p.theme.tokens.background.secondary} 0%, transparent) 0%,
    ${p => p.theme.tokens.background.secondary} 70%,
    ${p => p.theme.tokens.background.secondary} 100%
  );
`;

const BannerImage = styled('img')`
  display: block;
`;
