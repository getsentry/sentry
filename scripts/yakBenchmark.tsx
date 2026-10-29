// The benchmark must load the migrated implementations and app theme.
/* eslint-disable boundaries/dependencies, import-js/no-extraneous-dependencies -- All variants use the shared workspace dependencies. */
/* eslint-disable @sentry/scraps/prefer-container-responsive-props -- Verify both responsive APIs used by the original benchmark. */
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
const darkThemeClassName = '';

import {Button, LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code/inlineCode';
import {Kbd} from '@sentry/scraps/hotkey/kbd';
import {Container, Flex, Grid, Stack, Surface} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {DropdownButton} from '@sentry/scraps/menu/dropdownButton';
import {Quote} from '@sentry/scraps/quote/quote';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';
import {darkTheme, lightTheme} from '@sentry/scraps/theme';

const root = createRoot(document.getElementById('root')!);
const OverrideFlex = styled(Flex)`
  padding-left: 3px;
`;
const OverrideText = styled(Text)`
  font-size: 19px;
  color: rgb(1, 2, 3);
`;

function Fixture({count, phase, mixed}: {count: number; mixed: boolean; phase: number}) {
  return (
    <ThemeProvider theme={lightTheme}>
      <MemoryRouter>
        <Container containerType="inline-size" width="100%" padding="md">
          <Heading as="h1" size="xl">
            CSS component benchmark
          </Heading>
          <Stack gap="md">
            {Array.from({length: count}, (_, index) => (
              <Surface key={index} padding="md" radius="md">
                <Grid columns="180px 1fr auto" gap={{zero: 'sm', 'screen:md': 'lg'}}>
                  <Flex align="center" gap={phase ? 'lg' : 'md'}>
                    <Text bold variant={phase ? 'accent' : 'primary'}>
                      Row {index}
                    </Text>
                  </Flex>
                  <Stack gap="xs" minWidth="0">
                    <Text ellipsis size={phase ? 'sm' : 'md'}>
                      Synthetic component data
                    </Text>
                    <Container width={`${180 + (index % 31) + phase}px`}>
                      <Text tabular variant="secondary">
                        {index + phase}
                      </Text>
                    </Container>
                  </Stack>
                  <Text size="sm" monospace>
                    42ms
                  </Text>
                </Grid>
                <Separator orientation="horizontal" margin="sm 0" />
                {mixed && (
                  <Flex align="center" gap="md">
                    <Button size="sm" variant={phase ? 'primary' : 'secondary'}>
                      Run
                    </Button>
                    <DropdownButton size="sm" prefix="Sort" isOpen={!!phase}>
                      Duration
                    </DropdownButton>
                    <LinkButton size="sm" href="#details">
                      Details
                    </LinkButton>
                    <Link to="#trace">Trace</Link>
                    <InlineCode variant={phase ? 'neutral' : 'accent'}>
                      operation
                    </InlineCode>
                    <Kbd variant={phase ? 'debossed' : 'embossed'}>K</Kbd>
                    <Container width="128px">
                      <IndeterminateLoader />
                    </Container>
                    <Quote>
                      <Text>Sample</Text>
                    </Quote>
                  </Flex>
                )}
              </Surface>
            ))}
          </Stack>
        </Container>
      </MemoryRouter>
    </ThemeProvider>
  );
}

// Browser-only fixture. The runner owns timing, stylesheet instrumentation,
// alternating run order, and Chromium performance metrics.
Object.assign(window, {
  benchmarkRender(count: number, phase: number, mixed: boolean) {
    flushSync(() => root.render(<Fixture count={count} phase={phase} mixed={mixed} />));
    return document.body.offsetHeight;
  },
  benchmarkClear() {
    flushSync(() => root.render(null));
  },
  benchmarkCheck(dark: boolean) {
    document.documentElement.className = dark ? darkThemeClassName : '';
    flushSync(() =>
      root.render(
        <ThemeProvider theme={dark ? darkTheme : lightTheme}>
          <MemoryRouter>
            <Container containerType="inline-size">
              <OverrideFlex data-check="wrapper" paddingLeft="lg">
                <OverrideText data-check="text" size="md">
                  Override
                </OverrideText>
              </OverrideFlex>
              <Flex data-check="responsive" gap={{zero: 'sm', 'screen:md': 'lg'}} />
              <Text data-check="theme" variant="primary">
                Theme
              </Text>
              <Button data-check="button" variant="primary">
                Run
              </Button>
              <DropdownButton data-check="dropdown" prefix="Sort">
                Duration
              </DropdownButton>
              <DropdownButton
                data-check="dropdown-props"
                variant="primary"
                icon={<svg data-check="dropdown-icon" />}
              >
                Save
              </DropdownButton>
              {(
                [
                  'primary',
                  'secondary',
                  'warning',
                  'danger',
                  'transparent',
                  'link',
                ] as const
              ).map(variant => (
                <LinkButton
                  key={variant}
                  to="#target"
                  variant={variant}
                  data-check-link={variant}
                >
                  Link button
                </LinkButton>
              ))}
              <Flex paddingLeft="lg">
                {props => (
                  <div {...props} data-check="render-prop">
                    Render prop
                  </div>
                )}
              </Flex>
              <Flex data-check="container-query" gap={{zero: 'sm', lg: 'lg'}} />
              <ThemeProvider theme={dark ? lightTheme : darkTheme}>
                <Text data-check="nested-theme" variant="primary">
                  Nested theme
                </Text>
              </ThemeProvider>
              {(
                [
                  'primary',
                  'secondary',
                  'warning',
                  'danger',
                  'transparent',
                  'link',
                ] as const
              ).flatMap(variant =>
                (['md', 'sm', 'xs', 'zero'] as const).flatMap(size =>
                  (['rest', 'disabled', 'pressed'] as const).map(state => (
                    <Button
                      key={`${variant}-${size}-${state}`}
                      data-check-button={`${variant}-${size}-${state}`}
                      variant={variant}
                      size={size}
                      disabled={state === 'disabled'}
                      aria-expanded={state === 'pressed'}
                    >
                      Button
                    </Button>
                  ))
                )
              )}
            </Container>
          </MemoryRouter>
        </ThemeProvider>
      )
    );
    const style = (name: string) =>
      getComputedStyle(document.querySelector(`[data-check="${name}"]`)!);
    return {
      wrapperPadding: style('wrapper').paddingLeft,
      textSize: style('text').fontSize,
      textColor: style('text').color,
      responsiveGap: style('responsive').gap,
      themeColor: style('theme').color,
      buttonColor: style('button').color,
      dropdownWeight: style('dropdown').fontWeight,
      dropdownSurface: getComputedStyle(
        document.querySelector('[data-check="dropdown-props"]')!,
        '::after'
      ).backgroundColor,
      dropdownIcon: !!document.querySelector('[data-check="dropdown-icon"]'),
      linkButtons: Array.from(
        document.querySelectorAll('[data-check-link]'),
        element => ({
          variant: element.getAttribute('data-check-link'),
          color: getComputedStyle(element).color,
          surface:
            getComputedStyle(element, '::after').display === 'none'
              ? 'none'
              : getComputedStyle(element, '::after').backgroundColor,
        })
      ),
      renderPropPadding: style('render-prop').paddingLeft,
      containerGap: style('container-query').gap,
      nestedThemeColor: style('nested-theme').color,
      buttons: Array.from(document.querySelectorAll('[data-check-button]'), button => {
        const css = getComputedStyle(button);
        const surface = getComputedStyle(button, '::after');
        return {
          key: button.getAttribute('data-check-button'),
          color: css.color,
          height: css.height,
          padding: css.padding,
          opacity: css.opacity,
          cursor: css.cursor,
          radius: css.borderRadius,
          surface:
            surface.display === 'none'
              ? 'none'
              : {
                  background: surface.backgroundColor,
                  border: surface.border,
                  transform: surface.transform,
                },
        };
      }),
    };
  },
});
