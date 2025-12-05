import type {PropsWithChildren} from 'react';
import {Fragment} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import heroImg from 'sentry-images/debug/notifications/hero.png';

import {Flex} from 'sentry/components/core/layout/flex';
import {Heading, Text} from 'sentry/components/core/text';
// Mimicking useStoriesDarkMode -> Don't use these elsewhere please 🙏
// eslint-disable-next-line no-restricted-imports
import {darkTheme} from 'sentry/utils/theme/theme';

function DarkModeProvider(props: PropsWithChildren) {
  return <ThemeProvider theme={darkTheme}>{props.children}</ThemeProvider>;
}

export function DebugNotificationsLanding() {
  return (
    <Fragment>
      <DarkModeProvider>
        <Hero>
          <Flex direction="column" gap="md">
            <Squiggle />
            <HeroHeading as="h1">
              Welcome to the <em>Notification Debugger</em>
            </HeroHeading>
            <Text variant="muted" size="lg">
              This tool is in development! Keep an eye out for internal comms for when
              this is ready for you to use.
            </Text>
          </Flex>
          <img
            alt="A branching integration tree with developers admiring the leaves"
            width={680}
            height={320}
            src={heroImg}
          />
        </Hero>
      </DarkModeProvider>
      <FeatureContainer>
        <Heading as="h2" variant="success">
          Coming Soon
        </Heading>
        <Text size="lg">
          <ul>
            <li>Dynamic forms to preview a brand new notification</li>
            <li>Previewing all registered notification templates</li>
            <li>Example code to get started setting up your notification</li>
            <li>Integration payload previews (e.g. View BlockKit, View Teams Blocks)</li>
            <li>Resizable Email previews for mobile/desktop</li>
            <li>Internal documentation on Notification Platform concepts</li>
          </ul>
        </Text>
      </FeatureContainer>
    </Fragment>
  );
}

function Squiggle() {
  const theme = useTheme();

  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 13">
      <path
        stroke={theme.tokens.content.success}
        strokeMiterlimit="10"
        strokeWidth="3"
        d="M736 8.254c-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062-3.8 0-3.8-4.062-7.5-4.062-3.8 0-3.8 4.062-7.5 4.062"
      />
    </svg>
  );
}

const Hero = styled('div')`
  padding: ${p => `80px ${p.theme.space['2xl']}`};
  gap: ${p => p.theme.fontSize['2xl']};
  display: flex;
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  img {
    min-width: 320px;
    height: auto;
  }
`;

const HeroHeading = styled(Heading)`
  font-size: 36px;
  em {
    font-style: normal;
    display: inline-block;
    color: ${p => p.theme.tokens.content.success};
  }
`;

const FeatureContainer = styled('div')`
  margin: ${p => `${p.theme.space['3xl']} ${p.theme.space.xl}`};
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;
