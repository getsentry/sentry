import {createContext, Fragment, useContext, useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import type {SerializedStyles} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {
  Container,
  type ContainerProps,
  Flex,
  getSpacing,
  Grid,
  type GridProps,
  rc,
} from '@sentry/scraps/layout';
// Imported from the module rather than the `text` barrel on purpose. That
// barrel also re-exports `Prose`, which reaches `code` -> `codeBlock` ->
// `Button`, and `Button` imports this file — so going through it would close an
// import cycle and leave `Button` undefined at module-eval time.
import {Text} from '@sentry/scraps/text/text';

import {Overlay, PositionWrapper} from 'sentry/components/overlay';
import {defined} from 'sentry/utils/defined';
import type {UseHoverOverlayProps} from 'sentry/utils/useHoverOverlay';
import {useHoverOverlay} from 'sentry/utils/useHoverOverlay';

interface TooltipContextProps {
  /**
   * Specifies the DOM node where the tooltip should be rendered.
   * This is particularly useful for making the tooltip interactive within specific contexts,
   * such as inside a modal. By default the tooltip is rendered in the 'document.body'.
   */
  container: Element | DocumentFragment | null;
}

export const TooltipContext = createContext<TooltipContextProps>({container: null});

export interface TooltipProps extends UseHoverOverlayProps {
  /**
   * The content to show in the tooltip popover.
   */
  title: React.ReactNode;
  children?: React.ReactNode;
  /**
   * Disable the tooltip display entirely.
   */
  disabled?: boolean;
  /**
   * The max width the tooltip is allowed to grow.
   */
  maxWidth?: number;
  /**
   * Additional style rules for the tooltip content.
   */
  overlayStyle?: React.CSSProperties | SerializedStyles;
  /**
   * Padding around the tooltip content.
   *
   * Set to `'0'` when composing `Tooltip.Header`, `Tooltip.Body` and
   * `Tooltip.Footer` — each section applies its own padding so that it can span
   * the full width of the overlay, which a shared outer padding would prevent.
   *
   * @default 'md lg'
   */
  padding?: ContainerProps['padding'];
}

function TooltipComponent({
  children,
  overlayStyle,
  title,
  disabled = false,
  maxWidth,
  padding = 'md lg',
  isHoverable = true,
  ...hoverOverlayProps
}: TooltipProps) {
  const theme = useTheme();
  const {container} = useContext(TooltipContext);
  const {
    wrapTrigger,
    isOpen,
    snapClosed,
    overlayProps,
    placement,
    arrowData,
    arrowProps,
    reset,
    update,
  } = useHoverOverlay({...hoverOverlayProps, isHoverable});

  const {forceVisible} = hoverOverlayProps;

  // Reset the visibility when the tooltip becomes disabled
  useLayoutEffect(() => {
    if (disabled && isOpen) {
      reset();
    }
  }, [reset, disabled, isOpen]);

  // Reposition the tooltip when it is forced visible and the title changes
  // size. Depending on `children` would re-fire every render because a
  // ReactNode identity changes even when the rendered output does not.
  useLayoutEffect(() => {
    if (update && forceVisible) {
      update();
    }
  }, [update, title, forceVisible]);

  if (disabled || !title) {
    return children;
  }

  return (
    <Fragment>
      {wrapTrigger(children)}
      {createPortal(
        // Unmounting AnimatePresence (rather than toggling its child) skips
        // the exit animation entirely. snapClosed is set when another overlay
        // in the delay-group opens while this one was closing, preventing a
        // fading-out trail beside the incoming tooltip.
        snapClosed ? null : (
          <AnimatePresence>
            {isOpen ? (
              <PositionWrapper
                zIndex={theme.zIndex.tooltip}
                {...overlayProps}
                // The tooltip content is portaled to the document body, but
                // React events still bubble through the React tree — so a click
                // inside the tooltip would reach the trigger's interactive
                // ancestor (a Link, tab, menu item, ...) and fire its action.
                // Stop the interaction-initiating events here so interacting
                // with tooltip content (selecting text, clicking a copy button)
                // never triggers the element the tooltip is attached to.
                onClick={stopPropagation}
                onMouseDown={stopPropagation}
                onPointerDown={stopPropagation}
              >
                <TooltipContent
                  animated
                  maxWidth={maxWidth}
                  padding={padding}
                  arrowProps={arrowProps}
                  originPoint={arrowData}
                  placement={placement}
                  overlayStyle={overlayStyle}
                  data-tooltip
                >
                  {title}
                </TooltipContent>
              </PositionWrapper>
            ) : null}
          </AnimatePresence>
        ),
        container ?? document.body
      )}
    </Fragment>
  );
}

function stopPropagation(e: React.SyntheticEvent) {
  e.stopPropagation();
}

const TooltipContent = styled(Overlay, {
  shouldForwardProp: prop => prop !== 'maxWidth' && prop !== 'padding',
})<{maxWidth?: number; padding?: TooltipProps['padding']}>`
  ${p => rc('padding', p.padding, p.theme, getSpacing)};
  overflow-wrap: break-word;
  max-width: ${p => p.maxWidth ?? 225}px;
  color: ${p => p.theme.tokens.content.primary};
  font-size: ${p => p.theme.font.size.sm};
  line-height: 1.2;
  text-align: center;
`;

interface TooltipHeaderProps {
  /**
   * What the section describes, e.g. "Last Seen".
   */
  children: React.ReactNode;
  /**
   * Optional value pinned to the opposite edge of the header, e.g. the
   * relative time the rows below resolve.
   */
  trailing?: React.ReactNode;
}

/**
 * Names what the section below it describes. Written in sentence case — weight
 * and position carry the hierarchy, so it is deliberately not uppercased and
 * carries no bottom border.
 */
function TooltipHeader({children, trailing}: TooltipHeaderProps) {
  return (
    <Flex align="center" justify="between" gap="xs" padding="md lg">
      <Text bold align="left">
        {children}
      </Text>
      {defined(trailing) && (
        <Text bold align="right" wrap="nowrap">
          {trailing}
        </Text>
      )}
    </Flex>
  );
}

interface TooltipBodyProps {
  children: React.ReactNode;
  /**
   * The column tracks rows are laid out in. `Tooltip.Row` renders its children
   * straight into these tracks, so a column stays aligned across every row even
   * when one row's cell is wider than the same cell in the row above.
   *
   * @default '1fr'
   */
  columns?: GridProps['columns'];
  /**
   * @default '2xs sm'
   */
  gap?: GridProps['gap'];
}

/**
 * The padded region a tooltip's rows are laid out in, and the grid those rows
 * share.
 */
function TooltipBody({children, columns = '1fr', gap = '2xs sm'}: TooltipBodyProps) {
  return (
    <Grid columns={columns} gap={gap} align="center" padding="md lg">
      {children}
    </Grid>
  );
}

interface TooltipRowProps {
  children: React.ReactNode;
}

/**
 * One row of a `Tooltip.Body`. Renders as `display: contents` so that its
 * children become grid items of the body itself rather than of a nested box —
 * a row that owned its own grid would align its columns only against itself.
 */
function TooltipRow({children}: TooltipRowProps) {
  return <Container display="contents">{children}</Container>;
}

interface TooltipFooterProps {
  children: React.ReactNode;
  /**
   * Optional value pinned to the opposite edge of the footer.
   */
  trailing?: React.ReactNode;
}

/**
 * Trailing note for a tooltip, e.g. what the rows above are qualified by. Muted
 * so it reads as secondary to them.
 */
function TooltipFooter({children, trailing}: TooltipFooterProps) {
  return (
    <Flex align="center" justify="between" gap="xs" padding="md lg">
      <Text variant="muted" align="left">
        {children}
      </Text>
      {defined(trailing) && (
        <Text variant="muted" align="right" wrap="nowrap">
          {trailing}
        </Text>
      )}
    </Flex>
  );
}

/**
 * Tooltips show contextual information about an element on hover.
 *
 * For content that is a row of labelled values rather than a sentence, compose
 * it from the sections rather than passing a block of markup. Each section
 * applies its own padding so that it spans the full width of the overlay, which
 * means the tooltip has to opt out of the shared content padding:
 *
 * ```tsx
 * <Tooltip
 *   padding="0"
 *   title={
 *     <Fragment>
 *       <Tooltip.Header trailing="8mo ago">Last Seen</Tooltip.Header>
 *       <Tooltip.Body columns="max-content 1fr max-content">
 *         <Tooltip.Row>{cells}</Tooltip.Row>
 *       </Tooltip.Body>
 *     </Fragment>
 *   }
 * >
 *   {trigger}
 * </Tooltip>
 * ```
 *
 * Sections set their own text alignment, because a tooltip centers its content
 * by default — right for a sentence, wrong for a row of labelled values. They
 * set no font size, so they inherit the tooltip's.
 */
export const Tooltip = Object.assign(TooltipComponent, {
  Header: TooltipHeader,
  Body: TooltipBody,
  Row: TooltipRow,
  Footer: TooltipFooter,
});
