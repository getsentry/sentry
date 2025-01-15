import {useEffect, useRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Text from 'sentry/components/text';
import {space} from 'sentry/styles/space';
import testableTransition from 'sentry/utils/testableTransition';

/**
 * The default wrapper for the detail text.
 *
 * This can be overridden using the `customWrapper` prop for when the overlay
 * needs some special sizing due to background illustration constraints.
 */
const DefaultWrapper = styled('div')`
  width: 500px;
`;

const subItemAnimation = {
  initial: {
    opacity: 0,
    x: 60,
  },
  animate: {
    opacity: 1,
    x: 0,
    transition: testableTransition({
      type: 'spring',
      duration: 0.4,
    }),
  },
};

const Header = styled((props: React.ComponentProps<typeof motion.h2>) => (
  <motion.h2 variants={subItemAnimation} transition={testableTransition()} {...props} />
))`
  display: flex;
  align-items: center;
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(1)};
`;

const Body = styled((props: React.ComponentProps<typeof motion.div>) => (
  <motion.div variants={subItemAnimation} transition={testableTransition()} {...props} />
))`
  margin-bottom: ${space(2)};
`;

type ContentOpts = {
  Body: typeof Body;
  Header: typeof Header;
};

type PositioningStrategyOpts = {
  /**
   * The anchor reference component in the backgrounds rect.
   */
  anchorRect: DOMRect;
  /**
   * The main container component rect.
   */
  mainRect: DOMRect;
  /**
   * The wrapper being positioned Rect.
   */
  wrapperRect: DOMRect;
};

interface PageOverlayProps extends React.ComponentProps<'div'> {
  /**
   * When a background with an anchorRef is provided, you can customize the
   * positioning strategy for the wrapper by passing in a custom function here
   * that resolves the X and Y position.
   */
  positioningStrategy: (opts: PositioningStrategyOpts) => {x: number; y: number};
  text: (opts: ContentOpts) => React.ReactNode;
  animateDelay?: number;
  /**
   * Instead of rendering children with an animated gradient fly-in, render a
   * background component.
   *
   * Optionally the background may accept an `anchorRef` prop, which when available will anchor
   *
   * Instead of rendering children, render a background and disable the
   * gradient effect.
   */
  background?:
    | React.ComponentType
    | React.ComponentType<{anchorRef: React.Ref<SVGForeignObjectElement>}>;
  children?: React.ReactNode;
  /**
   * If special sizing of the details block is required you can use a custom
   * wrapper passed in here.
   *
   * This must forward its ref if you are using a background that provides an
   * anchor
   */
  customWrapper?: React.ComponentType;
}

/**
 * When a background with a anchor is used and no positioningStrategy is
 * provided, by default we'll align the top left of the container to the anchor
 */
const defaultPositioning = ({mainRect, anchorRect}: PositioningStrategyOpts) => ({
  x: anchorRect.x - mainRect.x,
  y: anchorRect.y - mainRect.y,
});

/**
 * Wrapper component that will render the wrapped content with an animated
 * overlay.
 *
 * If children are given they will be placed behind the overlay and hidden from
 * pointer events.
 *
 * If a background is given, the background will be rendered _above_ any
 * children (and will receive framer-motion variant changes for animations).
 * The background may also provide a `anchorRef` to aid in alignment of the
 * wrapper to a safe space in the background to aid in alignment of the wrapper
 * to a safe space in the background.
 */
function PageOverlay({
  positioningStrategy = defaultPositioning,
  text,
  animateDelay,
  background: BackgroundComponent,
  customWrapper,
  children,
  ...props
}: PageOverlayProps) {
  const contentRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const anchorRef = useRef<SVGForeignObjectElement>(null);

  useEffect(() => {
    if (contentRef.current === null || anchorRef.current === null) {
      return () => {};
    }

    /**
     * Align the wrapper component to the anchor by computing x/y values using
     * the passed function. By default if no function is specified it will align
     * to the top left of the anchor.
     */
    function anchorWrapper() {
      if (
        contentRef.current === null ||
        wrapperRef.current === null ||
        anchorRef.current === null
      ) {
        return;
      }

      // Absolute position the container, this avoids the browser having to reflow
      // the component
      wrapperRef.current.style.position = 'absolute';
      wrapperRef.current.style.left = `0px`;
      wrapperRef.current.style.top = `0px`;

      const mainRect = contentRef.current.getBoundingClientRect();
      const anchorRect = anchorRef.current.getBoundingClientRect();
      const wrapperRect = wrapperRef.current.getBoundingClientRect();

      // Compute the position of the wrapper
      const {x, y} = positioningStrategy({mainRect, anchorRect, wrapperRect});

      const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
      wrapperRef.current.style.transform = transform;
    }

    anchorWrapper();

    /**
     * Used to re-anchor the text wrapper to the anchor point in the background when
     * the size of the page changes.
     */
    let bgResizeObserver: ResizeObserver | null = null;

    // Observe changes to the upsell container to reanchor if available
    if (window.ResizeObserver) {
      bgResizeObserver = new ResizeObserver(anchorWrapper);
      bgResizeObserver.observe(contentRef.current);
    }

    return () => bgResizeObserver?.disconnect();
  }, [positioningStrategy]);

  const Wrapper = customWrapper ?? DefaultWrapper;

  const transition = testableTransition({
    delay: 1,
    duration: 1.2,
    ease: 'easeInOut',
    delayChildren: animateDelay ?? (BackgroundComponent ? 0.5 : 1.5),
    staggerChildren: 0.15,
  });

  return (
    <MaskedContent {...props}>
      {children}
      <ContentWrapper
        initial="initial"
        animate="animate"
        ref={contentRef}
        transition={transition}
        variants={{animate: {}}}
      >
        {BackgroundComponent && (
          <Background>
            <BackgroundComponent anchorRef={anchorRef} />
          </Background>
        )}
        <Wrapper ref={wrapperRef}>
          <Text>{text({Body, Header})}</Text>
        </Wrapper>
      </ContentWrapper>
    </MaskedContent>
  );
}

const absoluteFull = css`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
`;

const ContentWrapper = styled(motion.div)`
  ${absoluteFull}
  padding: 10%;
  z-index: 900;
`;

const Background = styled('div')`
  ${absoluteFull}
  z-index: -1;
  padding: 60px;
  display: flex;
  align-items: center;

  > * {
    width: 100%;
    min-height: 600px;
    height: 100%;
  }
`;

const MaskedContent = styled('div')`
  position: relative;
  overflow: hidden;
  flex-grow: 1;
  flex-basis: 0;
`;

export default PageOverlay;
