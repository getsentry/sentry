import {Component, createRef} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import Text from 'sentry/components/text';
import space from 'sentry/styles/space';
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

const Header = styled(motion.h2)`
  display: flex;
  align-items: center;
  font-weight: normal;
  margin-bottom: ${space(1)};
`;

Header.defaultProps = {
  variants: subItemAnimation,
  transition: testableTransition(),
};

const Body = styled(motion.div)`
  margin-bottom: ${space(2)};
`;

Body.defaultProps = {
  variants: subItemAnimation,
  transition: testableTransition(),
};

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

type Props = {
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
  /**
   * If special sizing of the details block is required you can use a custom
   * wrapper passed in here.
   *
   * This must forward its ref if you are using a background that provides an
   * anchor
   */
  customWrapper?: React.ComponentType;
};

type DefaultProps = Pick<Props, 'positioningStrategy'>;

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
class PageOverlay extends Component<Props> {
  static defaultProps: DefaultProps = {
    positioningStrategy: defaultPositioning,
  };

  componentDidMount() {
    if (this.contentRef.current === null || this.anchorRef.current === null) {
      return;
    }

    this.anchorWrapper();

    // Observe changes to the upsell container to reanchor if available
    if (window.ResizeObserver) {
      this.bgResizeObserver = new ResizeObserver(this.anchorWrapper);
      this.bgResizeObserver.observe(this.contentRef.current);
    }
  }

  componentWillUnmount() {
    this.bgResizeObserver?.disconnect();
  }

  /**
   * Used to re-anchor the text wrapper to the anchor point in the background when
   * the size of the page changes.
   */
  bgResizeObserver: ResizeObserver | null = null;

  contentRef = createRef<HTMLDivElement>();
  wrapperRef = createRef<HTMLDivElement>();
  anchorRef = createRef<SVGForeignObjectElement>();

  /**
   * Align the wrapper component to the anchor by computing x/y values using
   * the passed function. By default if no function is specified it will align
   * to the top left of the anchor.
   */
  anchorWrapper = () => {
    if (
      this.contentRef.current === null ||
      this.wrapperRef.current === null ||
      this.anchorRef.current === null
    ) {
      return;
    }

    // Absolute position the container, this avoids the browser having to reflow
    // the component
    this.wrapperRef.current.style.position = 'absolute';
    this.wrapperRef.current.style.left = `0px`;
    this.wrapperRef.current.style.top = `0px`;

    const mainRect = this.contentRef.current.getBoundingClientRect();
    const anchorRect = this.anchorRef.current.getBoundingClientRect();
    const wrapperRect = this.wrapperRef.current.getBoundingClientRect();

    // Compute the position of the wrapper
    const {x, y} = this.props.positioningStrategy({mainRect, anchorRect, wrapperRect});

    const transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    this.wrapperRef.current.style.transform = transform;
  };

  render() {
    const {
      text,
      children,
      animateDelay,
      background: BackgroundComponent,
      customWrapper,
      ...props
    } = this.props;
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
          ref={this.contentRef}
          transition={transition}
          variants={{animate: {}}}
        >
          {BackgroundComponent && (
            <Background>
              <BackgroundComponent anchorRef={this.anchorRef} />
            </Background>
          )}
          <Wrapper ref={this.wrapperRef}>
            <Text>{text({Body, Header})}</Text>
          </Wrapper>
        </ContentWrapper>
      </MaskedContent>
    );
  }
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

ContentWrapper.defaultProps = {
  initial: 'initial',
  animate: 'animate',
};

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
