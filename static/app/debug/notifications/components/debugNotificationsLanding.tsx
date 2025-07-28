import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import heroImg from 'sentry-images/debug/notifications/hero.png';

import {Flex} from 'sentry/components/core/layout/flex';
import {Heading} from 'sentry/components/core/text';
import {StoryDarkModeProvider} from 'sentry/stories/view/useStoriesDarkMode';

export function DebugNotificationsLanding() {
  return (
    <Fragment>
      <StoryDarkModeProvider>
        <Hero>
          <Container>
            <Flex direction="column" gap="2xl">
              <Flex direction="column" gap="md">
                <Border />
                <h1>
                  Welcome to the <TitleEmphasis>Notification Debugger</TitleEmphasis>
                </h1>
                <p>
                  This tool is in development! Keep an eye out for internal comms for when
                  this is ready for you to use.
                </p>
              </Flex>
            </Flex>
            <img
              alt="A branching integration tree with developers admiring the leaves"
              width={680}
              height={320}
              src={heroImg}
            />
          </Container>
        </Hero>
      </StoryDarkModeProvider>
      <Container>
        <Flex direction="column" gap="md" align="start">
          <Heading as="h2" variant="success">
            🚧 Features coming soon
          </Heading>
          <ul>
            <li>Fields to enter custom rendered template data</li>
            <li>Viewing all registered templates</li>
            <li>Mobile/Desktop email previews</li>
            <li>Integration raw payload previews (e.g. BlockKit, Teams Blocks)</li>
            <li>Custom renderer templates</li>
          </ul>
        </Flex>
      </Container>
    </Fragment>
  );
}

function Border() {
  const theme = useTheme();

  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 13">
      <path
        stroke={theme.tokens.content.success}
        strokeLinecap="round"
        strokeMiterlimit="10"
        strokeWidth="3"
        d="M736 8.25386c-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154-3.8 0-3.8-4.06154-7.5-4.06154-3.8 0-3.8 4.06154-7.5 4.06154"
      />
    </svg>
  );
}

const TitleEmphasis = styled('em')`
  font-style: normal;
  display: inline-block;
  color: ${p => p.theme.tokens.content.success};
`;

const Hero = styled('div')`
  padding: 48px 0;
  gap: ${p => p.theme.space['3xl']};
  display: flex;
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  h1 {
    font-size: 36px;
    margin-top: ${p => p.theme.space.md};
  }

  p {
    font-size: ${p => p.theme.fontSize.lg};
    text-wrap: balance;
    color: ${p => p.theme.tokens.content.muted};
  }

  img {
    min-width: 320px;
    height: auto;
  }
`;

const Container = styled('div')`
  max-width: 1080px;
  width: 100%;
  flex-grow: 1;
  flex-shrink: 1;
  margin-inline: auto;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['3xl']};
  padding-inline: ${p => p.theme.space.xl};
  padding-block: ${p => p.theme.space['3xl']};
  align-items: center;
  justify-content: center;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;
