import type {PropsWithChildren} from 'react';
import {Fragment, useMemo} from 'react';
import {ThemeProvider, useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import heroImg from 'sentry-images/stories/hero.png';

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

const frontmatter = {
  title: 'Sentry UI',
  hero: {
    title: 'Welcome to Sentry UI',
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
                <h1>{frontmatter.hero.title}</h1>
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
            <Card href="stories?name=app/styles/accessibility.mdx" title="Accessibility">
              <CardFigure />
            </Card>
            <Card href="stories?name=app/styles/colors.mdx" title="Color">
              <CardFigure />
            </Card>
            <Card href="stories?name=app/styles/content.mdx" title="Content">
              <CardFigure />
            </Card>
            <Card href="stories?name=app/styles/graphics.mdx" title="Graphics">
              <CardFigure />
            </Card>
            <Card href="stories?name=app/styles/typography.mdx" title="Typography">
              <CardFigure />
            </Card>
            <Card href="stories?name=app/styles/motion.mdx" title="Motion">
              <CardFigure />
            </Card>
          </CardGrid>
        </Flex>
      </Container>
    </Fragment>
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

const Hero = styled('div')`
  width: 100vw;
  padding: 48px 92px;
  gap: ${space(4)};
  display: flex;
  align-items: center;
  background: ${p => p.theme.tokens.background.tertiary};
  color: ${p => p.theme.tokens.content.primary};
`;

const Container = styled('div')`
  max-width: 1134px;
  width: calc(100vw - 32px);
  margin-inline: auto;
  display: flex;
  gap: ${space(4)};
  padding-inline: ${space(2)};
  padding-block: ${space(4)};
  align-items: center;
  justify-content: center;
`;

const CardGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: ${space(2)};
`;

interface CardProps {
  children: React.ReactNode;
  href: string;
  title: string;
}
function Card(props: CardProps) {
  return <CardLink to={props.href}>{props.children}</CardLink>;
}
const CardLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 256px;
  padding: ${space(2)} calc(${space(2)}*2);
  border: 1px solid ${p => p.theme.tokens.border.muted};
  border-radius: ${p => p.theme.borderRadius};
`;

function CardFigure(props: PropsWithChildren) {
  return (
    <Flex as="figure" role="image" align="center" justify="center">
      {props.children}
    </Flex>
  );
}
