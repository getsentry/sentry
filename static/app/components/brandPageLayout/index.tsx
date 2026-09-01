import artworkBackground from 'sentry-images/brandPageLayout/background.avif';
import artworkImage from 'sentry-images/brandPageLayout/full-art.avif';
import artworkOutline from 'sentry-images/brandPageLayout/outline.svg';

import {Container, Grid, Stack} from '@sentry/scraps/layout';
import {slot} from '@sentry/scraps/slot';

import {BrandLayoutArt} from './art';
import {BrandPageBackground} from './background';
import {InteractiveIllustration} from './interactiveIllustration';

const BrandPageLayoutSlot = slot(['headerStart', 'headerEnd', 'content'] as const);

interface BrandPageLayoutProps {
  children: React.ReactNode;
  artwork?: React.ReactNode;
  background?: React.ReactNode;
}

/**
 * Full-page layout for focused workflows paired with prominent brand artwork.
 */
function BrandPageLayoutRoot({
  artwork = (
    <BrandLayoutArt intrinsicHeight={1117} intrinsicWidth={1567} rightBleed={132}>
      <InteractiveIllustration
        backgroundSrc={artworkBackground}
        outlineSrc={artworkOutline}
        src={artworkImage}
      />
    </BrandLayoutArt>
  ),
  background = <BrandPageBackground />,
  children,
}: BrandPageLayoutProps) {
  return (
    <BrandPageLayoutSlot.Provider>
      {children}
      <Grid
        as="main"
        columns={{
          'screen:xs': 'minmax(0, 1fr)',
          'screen:md': 'clamp(12rem, calc(100vw - 48rem), 50vw) minmax(30rem, 1fr)',
        }}
        minHeight="100dvh"
        overflow="hidden"
        position="relative"
        background="primary"
      >
        <Container
          as="aside"
          display={{'screen:xs': 'none', 'screen:md': 'block'}}
          pointerEvents="none"
          position="relative"
        >
          <Container position="absolute" inset="0" overflow="hidden">
            {background}
          </Container>
          <Container
            position="absolute"
            inset="0"
            overflow="visible"
            pointerEvents="none"
          >
            {artwork}
          </Container>
        </Container>

        <Stack
          minWidth="0"
          minHeight="100dvh"
          padding={{'screen:xs': 'xl', 'screen:md': '2xl', 'screen:xl': '3xl'}}
        >
          <Grid
            as="header"
            columns="max-content minmax(0, 1fr) max-content"
            align="start"
          >
            <BrandPageLayoutSlot.Outlet name="headerStart">
              {(props, hasHeaderStart) =>
                hasHeaderStart ? <Container minWidth="0" {...props} /> : null
              }
            </BrandPageLayoutSlot.Outlet>

            <BrandPageLayoutSlot.Outlet name="headerEnd">
              {(props, hasHeaderEnd) =>
                hasHeaderEnd ? <Container {...props} style={{gridColumn: 3}} /> : null
              }
            </BrandPageLayoutSlot.Outlet>
          </Grid>

          <BrandPageLayoutSlot.Outlet name="content">
            {(props, hasContent) =>
              hasContent ? <Container flex="1" minWidth="0" {...props} /> : null
            }
          </BrandPageLayoutSlot.Outlet>
        </Stack>
      </Grid>
    </BrandPageLayoutSlot.Provider>
  );
}

/** Places content at the start edge of the page header. */
function HeaderStart({children}: {children: React.ReactNode}) {
  return <BrandPageLayoutSlot name="headerStart">{children}</BrandPageLayoutSlot>;
}

/** Places content at the end edge of the page header. */
function HeaderEnd({children}: {children: React.ReactNode}) {
  return <BrandPageLayoutSlot name="headerEnd">{children}</BrandPageLayoutSlot>;
}

/** Places the primary page content below the header. */
function Content({children}: {children: React.ReactNode}) {
  return <BrandPageLayoutSlot name="content">{children}</BrandPageLayoutSlot>;
}

/**
 * Composes a full-page branded workflow from artwork, background, header, and
 * primary-content regions.
 */
export const BrandPageLayout = Object.assign(BrandPageLayoutRoot, {
  Content,
  HeaderEnd,
  HeaderStart,
});

export {BrandLayoutArt, BrandPageBackground, InteractiveIllustration};
