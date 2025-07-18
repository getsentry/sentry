import type {PropsWithChildren} from 'react';
import {Fragment} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import performanceWaitingForSpan from 'sentry-images/spot/performance-waiting-for-span.svg';
import heroImg from 'sentry-images/stories/landing/hero.png';

import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import {DarkThemeProvider} from 'sentry/utils/theme/useDarkTheme';

import {Colors, Icons, Typography} from './figures';

const frontmatter = {
  title: 'Sentry UI',
  hero: {
    title: 'Welcome to {title}',
    tagline:
      'Resources, guides, and API reference to help you build accessible, consistent user interfaces at Sentry.',
    image: {
      alt: 'A floating island with a developer typing on a laptop',
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
      <DarkThemeProvider>
        <Hero>
          <Container>
            <Flex direction="column" gap={space(3)}>
              <Flex direction="column" gap={space(1)}>
                <Border />
                <h1>
                  Welcome to <TitleEmphasis>Sentry UI</TitleEmphasis>
                </h1>
                <p>{frontmatter.hero.tagline}</p>
              </Flex>
              <Flex gap={space(1)}>
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
          </Container>
        </Hero>
      </DarkThemeProvider>

      <Container>
        <Flex as="section" direction="column" gap={space(4)} flex={1}>
          <Flex direction="column" gap={space(1)}>
            <h2>Learn the Foundations</h2>
            <p>
              The following guides will help you understand Sentry's foundational design
              principles.
            </p>
          </Flex>
          <CardGrid>
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
          </CardGrid>
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

const Hero = styled('div')`
  padding: 48px 0;
  gap: ${space(4)};
  display: flex;
  align-items: center;
  background: ${p => p.theme.tokens.background.secondary};
  color: ${p => p.theme.tokens.content.primary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  h1 {
    font-size: 36px;
    margin-top: ${space(1)};
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
  gap: ${space(4)};
  padding-inline: ${space(2)};
  padding-block: ${space(4)};
  align-items: center;
  justify-content: center;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    flex-direction: row;
  }
`;

const CardGrid = styled('div')`
  display: flex;
  flex-flow: row wrap;
  gap: ${space(2)};
`;

interface CardProps {
  children: React.ReactNode;
  href: string;
  title: string;
}
function Card(props: CardProps) {
  return (
    <CardLink to={props.href}>
      {props.children}
      <CardTitle>{props.title}</CardTitle>
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
  padding: ${space(2)};
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

const CardTitle = styled('span')`
  margin: 0;
  margin-top: auto;
  margin-bottom: ${space(2)};
  padding: ${space(1)} ${space(2)};
  width: 100%;
  height: 24px;
  font-size: 24px;
  font-weight: ${p => p.theme.fontWeight.bold};
  color: currentColor;
`;

function CardFigure(props: PropsWithChildren) {
  return (
    <Flex as="figure" role="image" align="center" justify="center">
      {props.children}
    </Flex>
  );
}
