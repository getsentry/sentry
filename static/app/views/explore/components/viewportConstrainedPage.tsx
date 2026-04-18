import {css} from '@emotion/react';

import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {classNames} from 'sentry/utils/classNames';
import {SHORT_VIEWPORT_HEIGHT} from 'sentry/utils/useIsShortViewport';

interface ViewportConstrainedPageProps extends Layout.MainProps {
  constrained?: boolean;
  hideFooter?: boolean;
}

/**
 * A page layout that constrains itself to the viewport height to prevent
 * window-level scrolling. Uses CSS size containment so that the page's
 * intrinsic size doesn't bubble up through the flex chain — the flex
 * algorithm sizes it to exactly the remaining space after siblings
 * (TopBar, Footer, etc.), and content within must manage its own
 * overflow (e.g. via scrollable table bodies).
 *
 * When constrained, the global footer sibling is hidden on smaller
 * viewport heights and when `hideFooter` is set.
 */
export function ViewportConstrainedPage({
  constrained = true,
  hideFooter,
  ...rest
}: ViewportConstrainedPageProps) {
  const layoutMain = (className?: string) => (
    <Layout.Main
      width="full"
      {...rest}
      className={classNames(rest.className, className)}
    />
  );

  if (!constrained) {
    return (
      <Flex direction="column" minHeight="0">
        {({className}) => layoutMain(className)}
      </Flex>
    );
  }

  return (
    <Flex direction="column" minHeight="0" overflow="hidden">
      {({className}) =>
        layoutMain(
          classNames(
            className,
            css`
              contain: size;

              @media (max-height: ${SHORT_VIEWPORT_HEIGHT}px) {
                ~ footer {
                  display: none;
                }
              }

              ${hideFooter &&
              css`
                ~ footer {
                  display: none;
                }
              `}
            `
          )
        )
      }
    </Flex>
  );
}
