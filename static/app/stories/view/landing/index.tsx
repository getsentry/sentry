import type {PropsWithChildren} from 'react';
import {Fragment, useMemo} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import performanceWaitingForSpan from 'sentry-images/spot/performance-waiting-for-span.svg';
import heroImg from 'sentry-images/stories/landing/hero.png';

import type {LinkButtonProps} from 'sentry/components/core/button/linkButton';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {Theme} from 'sentry/utils/theme';
// we need the hero to always use values from the dark theme
// eslint-disable-next-line no-restricted-imports
import {darkTheme} from 'sentry/utils/theme';
import {DO_NOT_USE_darkChonkTheme} from 'sentry/utils/theme/theme.chonk';

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
      <AlwaysDarkThemeProvider>
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
      </AlwaysDarkThemeProvider>

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

function AlwaysDarkThemeProvider(props: PropsWithChildren) {
  const theme = useTheme();

  const localThemeValue = useMemo(
    () => (theme.isChonk ? DO_NOT_USE_darkChonkTheme : darkTheme),
    [theme]
  );

  return <ThemeProvider theme={localThemeValue as Theme}>{props.children}</ThemeProvider>;
}

const TitleEmphasis = styled('em')`
  font-style: normal;
  display: inline-block;
  transform: rotate(-3deg) translate(1px, -2px);
  color: ${p => p.theme.tokens.content.accent};
`;

const Hero = styled('div')`
  width: 100vw;
  padding: 48px 16px;
  gap: ${space(4)};
  display: flex;
  align-items: center;
  background: ${p => p.theme.tokens.background.tertiary};
  color: ${p => p.theme.tokens.content.primary};

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

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: 48px 92px;
  }
`;

const Container = styled('div')`
  max-width: 1134px;
  width: calc(100vw - 32px);
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
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  gap: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
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
  width: 100%;
  height: 256px;
  padding: ${space(2)};
  border: 1px solid ${p => p.theme.tokens.border.muted};
  border-radius: ${p => p.theme.borderRadius};
  transition: initial 80ms ease-out;
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
`;

const CardTitle = styled('span')`
  margin: 0;
  margin-top: ${space(1)};
  width: 100%;
  height: 24px;
  font-size: 24px;
  padding: ${space(1)} ${space(2)};
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
