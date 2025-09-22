import type {PropsWithChildren} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import performanceWaitingForSpan from 'sentry-images/spot/performance-waiting-for-span.svg';
import heroImg from 'sentry-images/stories/landing/robopigeon.png';

import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Container, Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Heading, Text} from 'sentry/components/core/text';
import {IconOpen} from 'sentry/icons';
import {Acronym} from 'sentry/stories/view/landing/acronym';
import {StoryDarkModeProvider} from 'sentry/stories/view/useStoriesDarkMode';

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
        to: '/stories?name=app/styles/colors.mdx',
        priority: 'primary',
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
  return (
    <Fragment>
      <StoryDarkModeProvider>
        <Flex
          align="center"
          gap="3xl"
          padding="48px 0"
          css={{
            background: 'var(--color-background-secondary)',
            color: 'var(--color-content-primary)',
            borderBottom: '1px solid var(--color-border-primary)',
            '& h1': {
              fontSize: '36px',
              marginTop: 'var(--space-md)',
            },
            '& p': {
              fontSize: 'var(--font-size-lg)',
              textWrap: 'balance',
              color: 'var(--color-content-muted)',
            },
            '& img': {
              minWidth: '320px',
              height: 'auto',
            },
          }}
        >
          <Flex
            direction={{xs: 'column', md: 'row'}}
            gap="3xl"
            padding="3xl xl"
            align="center"
            justify="center"
            css={{
              maxWidth: '1080px',
              width: '100%',
              flexGrow: 1,
              flexShrink: 1,
              marginInline: 'auto',
            }}
          >
            <Flex direction="column" gap="2xl">
              <Flex direction="column" gap="md">
                <Border />
                <Heading as="h1">
                  Welcome to{' '}
                  <Text
                    as="em"
                    variant="accent"
                    css={{
                      fontStyle: 'normal',
                      display: 'inline-block',
                      transform: 'rotate(-3deg) translate(1px, -2px)',
                    }}
                  >
                    Scraps
                  </Text>
                </Heading>
                <Text as="p">{frontmatter.hero.tagline}</Text>
              </Flex>
              <Flex gap="md">
                {frontmatter.hero.actions.map(props => (
                  <LinkButton {...props} key={props.to} />
                ))}
              </Flex>
            </Flex>
            <img
              alt={frontmatter.hero.image.alt}
              width={680}
              height={320}
              src={frontmatter.hero.image.file}
            />
          </Flex>
        </Flex>
      </StoryDarkModeProvider>

      <Flex
        direction="column"
        gap="3xl"
        padding="3xl xl"
        align="center"
        justify="center"
        css={{
          maxWidth: '1080px',
          width: '100%',
          flexGrow: 1,
          flexShrink: 1,
          marginInline: 'auto',
        }}
      >
        <Acronym />
      </Flex>

      <Flex
        direction="column"
        gap="3xl"
        padding="3xl xl"
        align="center"
        justify="center"
        css={{
          maxWidth: '1080px',
          width: '100%',
          flexGrow: 1,
          flexShrink: 1,
          marginInline: 'auto',
        }}
      >
        <Flex as="section" direction="column" gap="3xl" flex={1}>
          <Flex direction="column" gap="md">
            <Heading as="h2">Learn the Foundations</Heading>
            <Text as="p">
              The following guides will help you understand Sentry's foundational design
              principles.
            </Text>
          </Flex>
          <Flex wrap gap="xl">
            <Card href="/stories?name=app/styles/colors.mdx" title="Color">
              <CardFigure>
                <Colors />
              </CardFigure>
            </Card>
            <Card href="/stories/?name=app%2Ficons%2Ficons.stories.tsx" title="Icons">
              <CardFigure>
                <Icons />
              </CardFigure>
            </Card>
            <Card
              href="/stories/?name=app%2Fstyles%2Ftypography.stories.tsx"
              title="Typography"
            >
              <CardFigure>
                <Typography />
              </CardFigure>
            </Card>
            <Card href="/stories/?name=app%2Fstyles%2Fimages.stories.tsx" title="Images">
              <CardFigure>
                <img src={performanceWaitingForSpan} />
              </CardFigure>
            </Card>
          </Flex>
        </Flex>
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

interface CardProps {
  children: React.ReactNode;
  href: string;
  title: string;
}
function Card(props: CardProps) {
  return (
    <CardLink to={props.href}>
      {props.children}
      <Text
        as="span"
        size="xl"
        bold
        css={{
          margin: 0,
          marginTop: 'auto',
          marginBottom: 'var(--space-xl)',
          padding: 'var(--space-md) var(--space-xl)',
          width: '100%',
          height: '24px',
          fontSize: '24px',
        }}
      >
        {props.title}
      </Text>
    </CardLink>
  );
}
const CardLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  width: calc(100% * 3 / 5);
  aspect-ratio: 2/1;
  padding: ${p => p.theme.space.xl};
  border: 1px solid ${p => p.theme.tokens.border.muted};
  border-radius: ${p => p.theme.borderRadius};
  transition: all 80ms ease-out;
  transition-property: background-color, color, border-color;

  &:hover,
  &:focus {
    background: ${p => p.theme.tokens.background.secondary};
    color: ${p => p.theme.tokens.content.accent};
    border-color: ${p => p.theme.tokens.border.primary};
  }

  img {
    width: 100%;
    height: auto;
    max-width: 509px;
    max-height: 170px;
  }

  @media screen and (min-width: ${p => p.theme.breakpoints.md}) {
    max-width: calc(50% - 32px);
  }
`;

function CardFigure(props: PropsWithChildren) {
  return (
    <Flex as="figure" role="image" align="center" justify="center">
      {props.children}
    </Flex>
  );
}
