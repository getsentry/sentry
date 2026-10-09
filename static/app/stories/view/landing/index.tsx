import type {PropsWithChildren} from 'react';
import {Fragment} from 'react';
import {css, useTheme, type Theme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import heroImg from 'sentry-images/stories/landing/robopigeon.png';

import type {LinkButtonProps} from '@sentry/scraps/button';
import {LinkButton} from '@sentry/scraps/button';
import {Image} from '@sentry/scraps/image';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {IconOpen} from 'sentry/icons';
import {Acronym} from 'sentry/stories/view/landing/acronym';
import {StoryDarkModeProvider} from 'sentry/stories/view/useStoriesDarkMode';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useOrganization} from 'sentry/utils/useOrganization';

import {Colors, Icons, Typography} from './figures';

const frontmatter = {
  title: 'Scraps',
  hero: {
    title: 'Welcome to {title}',
    tagline:
      'Resources, guides, and reference to help you build accessible, consistent user interfaces at Sentry.',
    image: {
      alt: 'A robotic pigeon with a leather aviator hat and rocket boosters',
      file: heroImg,
    },
    actions: [
      {
        children: 'Get Started',
        to: '/scraps/principles/tokens/',
        variant: 'primary',
      },
      {
        children: 'View on GitHub',
        to: 'https://github.com/getsentry/sentry',
        external: true,
        icon: <IconOpen />,
      },
    ] satisfies LinkButtonProps[],
  },
};

export function StoryLanding() {
  const organization = useOrganization();

  return (
    <Fragment>
      <StoryDarkModeProvider>
        <Flex
          gap="3xl"
          align="center"
          background="secondary"
          borderBottom="primary"
          padding="3xl 0"
        >
          <Flex
            maxWidth="1080px"
            width="100%"
            flexGrow={1}
            flexShrink={1}
            marginLeft="auto"
            marginRight="auto"
            direction={{zero: 'column', '3xl': 'row'}}
            gap="3xl"
            padding="3xl xl"
            align="center"
            justify="center"
          >
            <Stack gap="2xl">
              <Stack gap="md">
                <Border />
                <Container marginTop="md">
                  <Heading as="h1">
                    Welcome to <TitleEmphasis>Scraps</TitleEmphasis>
                  </Heading>
                </Container>
                <Text as="p" size="lg" variant="muted" textWrap="balance">
                  {frontmatter.hero.tagline}
                </Text>
              </Stack>
              <Flex gap="md">
                {frontmatter.hero.actions.map(props => {
                  // Normalize internal paths with organization context
                  const to =
                    typeof props.to === 'string' && !props.external
                      ? normalizeUrl(`/organizations/${organization.slug}${props.to}`)
                      : props.to;
                  return <LinkButton {...props} to={to} key={props.to} />;
                })}
              </Flex>
            </Stack>
            <HeroImage
              alt={frontmatter.hero.image.alt}
              width="680px"
              height="auto"
              loading="eager"
              src={frontmatter.hero.image.file}
            />
          </Flex>
        </Flex>
      </StoryDarkModeProvider>

      <Flex
        maxWidth="1080px"
        width="100%"
        flexGrow={1}
        flexShrink={1}
        marginLeft="auto"
        marginRight="auto"
        direction={{zero: 'column', '3xl': 'row'}}
        gap="3xl"
        padding="3xl xl"
        align="center"
        justify="center"
      >
        <Acronym />
      </Flex>

      <Flex
        maxWidth="1080px"
        width="100%"
        flexGrow={1}
        flexShrink={1}
        marginLeft="auto"
        marginRight="auto"
        direction={{zero: 'column', '3xl': 'row'}}
        gap="3xl"
        padding="3xl xl"
        align="center"
        justify="center"
      >
        <Stack as="section" gap="3xl" flex={1}>
          <Stack gap="md">
            <Heading as="h2">Learn the Foundations</Heading>
            <Text as="p">
              The following guides will help you understand Sentry's foundational design
              principles.
            </Text>
          </Stack>
          <Flex wrap="wrap" gap="xl">
            <Card
              to={{
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/scraps/principles/tokens/`
                ),
              }}
              title="Tokens"
            >
              <CardFigure>
                <Colors />
              </CardFigure>
            </Card>
            <Card
              to={{
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/scraps/principles/icons/`
                ),
              }}
              title="Icons"
            >
              <CardFigure>
                <Icons />
              </CardFigure>
            </Card>
            <Card
              to={{
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/scraps/core/text/`
                ),
              }}
              title="Typography"
            >
              <CardFigure>
                <Typography />
              </CardFigure>
            </Card>
            <Card
              to={{
                pathname: normalizeUrl(
                  `/organizations/${organization.slug}/scraps/core/flex/`
                ),
              }}
              title="Layout"
            >
              <CardFigure>
                <Text>Layout</Text>
              </CardFigure>
            </Card>
          </Flex>
        </Stack>
      </Flex>
    </Fragment>
  );
}

function Border() {
  const theme = useTheme();

  return (
    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 480 13">
      <path
        stroke={theme.tokens.content.accent}
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
  transform: rotate(-3deg) translate(1px, -2px);
  color: ${p => p.theme.tokens.content.accent};
`;

const HeroImage = styled(Image)`
  min-width: 320px;
`;

interface CardProps {
  children: React.ReactNode;
  title: string;
  to: LocationDescriptor;
}

function Card(props: CardProps) {
  return (
    <Stack
      flexGrow={1}
      width="calc(100% * 3 / 5)"
      maxWidth={{zero: 'none', '3xl': 'calc(50% - 32px)'}}
      padding="xl"
      border="secondary"
      radius="md"
      css={cardLinkCss}
    >
      {stackProps => (
        <Link {...stackProps} to={props.to}>
          {props.children}
          <Container
            marginTop="auto"
            marginBottom="xl"
            padding="md xl"
            width="100%"
            height="24px"
          >
            <Text as="span" size="2xl" bold>
              {props.title}
            </Text>
          </Container>
        </Link>
      )}
    </Stack>
  );
}

const cardLinkCss = (theme: Theme) => css`
  color: ${theme.tokens.content.primary};
  aspect-ratio: 2/1;
  transition: all 80ms ease-out;
  transition-property: background-color, color, border-color;

  &:hover,
  &:focus {
    background: ${theme.tokens.background.secondary};
    color: ${theme.tokens.content.accent};
    border-color: ${theme.tokens.border.primary};
  }
`;

function CardFigure(props: PropsWithChildren) {
  return (
    <Flex as="figure" role="image" align="center" justify="center">
      {props.children}
    </Flex>
  );
}
