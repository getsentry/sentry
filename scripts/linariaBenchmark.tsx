// The benchmark must load the migrated implementations and app theme.
/* eslint-disable boundaries/dependencies */
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import {MemoryRouter} from 'react-router';
import {ThemeProvider} from '@emotion/react';
import styled from '@emotion/styled';
import {darkThemeClassName} from 'linaria-benchmark-theme';

import {Button, LinkButton} from '@sentry/scraps/button';
import {InlineCode} from '@sentry/scraps/code/inlineCode';
import {DropdownButton} from '@sentry/scraps/dropdownMenu/dropdownButton';
import {Kbd} from '@sentry/scraps/hotkey/kbd';
import {Container, Flex, Grid, Stack, Surface} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {IndeterminateLoader} from '@sentry/scraps/loader';
import {Quote} from '@sentry/scraps/quote/quote';
import {Separator} from '@sentry/scraps/separator';
import {Heading, Text} from '@sentry/scraps/text';

import {darkTheme, lightTheme} from 'sentry/utils/theme/theme';

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
          </Container>
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
    };
  },
});
