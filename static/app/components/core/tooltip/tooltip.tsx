import {createContext, Fragment, useContext, useLayoutEffect} from 'react';
import {createPortal} from 'react-dom';
import type {SerializedStyles} from '@emotion/react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import {Container, Flex, Grid, type GridProps} from '@sentry/scraps/layout';
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

export const TooltipContext = createContext<TooltipContextProps>({
  container: null,
});

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
}

function TooltipComponent({
  children,
  overlayStyle,
  title,
  disabled = false,
  maxWidth,
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
  shouldForwardProp: prop => prop !== 'maxWidth',
})<{maxWidth?: number}>`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};

  /*
   * Sections pull back out to the overlay's edges, cancelling the padding above
   * so that a full width row or separator can reach them, and re-applying it
   * themselves so their own content stays inset.
   */
  > [data-tooltip-section] {
    margin-inline: calc(-1 * ${p => p.theme.space.lg});
    margin-block-start: calc(-1 * ${p => p.theme.space.md});
  }

  /*
   * Only the outermost sections cancel the block padding — doing it on every
   * one would collapse the space between two of them, since adjacent negative
   * margins compound. This cannot key off the first child, because the overlay
   * renders its arrow ahead of the content, so a section is never first.
   */
  > [data-tooltip-section] ~ [data-tooltip-section] {
    margin-block-start: 0;
  }

  > [data-tooltip-section]:last-child {
    margin-block-end: calc(-1 * ${p => p.theme.space.md});
  }

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
   * Rendered before the label, e.g. an icon identifying what the section is
   * about. Rendered as given, so that a graphic is not forced into text styles.
   */
  leadingItems?: React.ReactNode;
  /**
   * Value pinned to the opposite edge of the header, e.g. the relative time the
   * rows below resolve.
   */
  trailingItems?: React.ReactNode;
}

/**
 * Names what the section below it describes. Written in sentence case — weight
 * and position carry the hierarchy, so it is deliberately not uppercased and
 * carries no bottom border.
 */
function TooltipHeader({children, leadingItems, trailingItems}: TooltipHeaderProps) {
  return (
    <Flex align="center" justify="between" gap="xs" padding="md lg" data-tooltip-section>
      <Flex align="center" gap="xs">
        {leadingItems}
        <Text bold align="left">
          {children}
        </Text>
      </Flex>
      {defined(trailingItems) && (
        <Text bold align="right" wrap="nowrap">
          {trailingItems}
        </Text>
      )}
    </Flex>
  );
}

interface TooltipGridProps {
  children: React.ReactNode;
  /**
   * The column tracks rows are laid out in. `Tooltip.Row` renders its cells
   * straight into these tracks, so a column stays aligned across every row even
   * when one row's cell is wider than the same cell in the row above.
   *
   * A row with both `leadingItems` and `trailingItems` occupies three tracks,
   * which is `'max-content 1fr max-content'`.
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
function TooltipGrid({children, columns = '1fr', gap = '2xs sm'}: TooltipGridProps) {
  return (
    <Grid columns={columns} gap={gap} align="center" padding="md lg" data-tooltip-section>
      {children}
    </Grid>
  );
}

interface TooltipRowProps {
  /**
   * The row's main cell.
   */
  children: React.ReactNode;
  /**
   * Cell before the main one, e.g. what the row's value is labelled by.
   */
  leadingItems?: React.ReactNode;
  /**
   * Cell after the main one.
   */
  trailingItems?: React.ReactNode;
}

/**
 * One row of a `Tooltip.Grid`, as up to three cells.
 *
 * Renders as `display: contents` so that those cells become grid items of the
 * grid itself rather than of a nested box — a row that established its own
 * layout box would align its columns only against itself, which is the whole
 * thing a shared grid is for. Rows in one grid should therefore fill the same
 * tracks as each other.
 */
function TooltipRow({children, leadingItems, trailingItems}: TooltipRowProps) {
  return (
    <Container display="contents">
      {leadingItems}
      {children}
      {trailingItems}
    </Container>
  );
}

interface TooltipFooterProps {
  children: React.ReactNode;
  /**
   * Rendered before the label, e.g. an icon. Rendered as given, so that a
   * graphic is not forced into text styles.
   */
  leadingItems?: React.ReactNode;
  /**
   * Value pinned to the opposite edge of the footer.
   */
  trailingItems?: React.ReactNode;
}

/**
 * Trailing note for a tooltip, e.g. what the rows above are qualified by. Muted
 * so it reads as secondary to them.
 */
function TooltipFooter({children, leadingItems, trailingItems}: TooltipFooterProps) {
  return (
    <Flex align="center" justify="between" gap="xs" padding="md lg" data-tooltip-section>
      <Flex align="center" gap="xs">
        {leadingItems}
        <Text variant="muted" align="left">
          {children}
        </Text>
      </Flex>
      {defined(trailingItems) && (
        <Text variant="muted" align="right" wrap="nowrap">
          {trailingItems}
        </Text>
      )}
    </Flex>
  );
}

/**
 * Tooltips show contextual information about an element on hover.
 *
 * For content that is a row of labelled values rather than a sentence, compose
 * it from the sections rather than passing a block of markup. Sections pull back
 * out to the overlay's edges and re-apply the padding themselves, so a full
 * width row reaches the edges while its content stays inset. Nothing to pass:
 *
 * ```tsx
 * <Tooltip
 *   title={
 *     <Fragment>
 *       <Tooltip.Header trailingItems="8mo ago">Last Seen</Tooltip.Header>
 *       <Tooltip.Grid columns="max-content 1fr max-content">
 *         <Tooltip.Row leadingItems={<Tag>UTC</Tag>} trailingItems={time}>
 *           {date}
 *         </Tooltip.Row>
 *       </Tooltip.Grid>
 *     </Fragment>
 *   }
 * >
 *   {trigger}
 * </Tooltip>
 * ```
 *
 * That holds wherever the sections are rendered from. A component that renders
 * them internally is covered too, because its sections are still the overlay's
 * own children in the DOM.
 *
 * Sections set their own text alignment, because a tooltip centers its content
 * by default — right for a sentence, wrong for a row of labelled values. Cells
 * passed to a `Tooltip.Row` are yours to align. They set no font size, so they
 * inherit the tooltip's.
 */
export const Tooltip = Object.assign(TooltipComponent, {
  Header: TooltipHeader,
  Grid: TooltipGrid,
  Row: TooltipRow,
  Footer: TooltipFooter,
});
