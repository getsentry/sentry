import {type PropsWithChildren, useEffect, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {useFocusWithin, useHover} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';

/**
 * Selector for scoping collapsed hint styles in {@link SchemaHintsList}.
 * Must match the attribute set on {@link SchemaHintsSection}'s root.
 */
export const SCHEMA_HINTS_SECTION_SELECTOR = '[data-schema-hints-section]';

/** Must match `transition` duration on `FloatingPanel` for grid-template-rows. */
const SCHEMA_HINTS_GRID_TRANSITION_MS = 150;

const Inner = styled('div')`
  min-height: 0;
  overflow: hidden;
  padding-bottom: ${p => p.theme.space.md};
`;

const FloatingPanel = styled('div')`
  --horizontalOverflow: 2rem;
  background-color: ${p => p.theme.tokens.background.primary};
  padding: 0 var(--horizontalOverflow);
  position: absolute;
  top: 0;
  left: calc(-1 * var(--horizontalOverflow));
  right: calc(-1 * var(--horizontalOverflow));
  display: grid;
  grid-template-rows: 0fr;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  transition: grid-template-rows ${SCHEMA_HINTS_GRID_TRANSITION_MS}ms ease;
`;

const Wrapper = styled('div')<{
  $overflowClip: boolean;
  $standaloneBottomBorder?: boolean;
}>`
  position: relative;
  height: ${p => p.theme.space.sm};
  margin-top: ${p => p.theme.space.md};
  margin-bottom: 0;
  /* Fills the width of the parent (e.g. Layout.Main inside ExploreBodySearch). */
  width: 100%;
  min-width: 0;
  align-self: stretch;
  /* Collapsed: clip absolute panel so inner background cannot cover ExploreBodySearch's
     bottom border. While expanded (and briefly after collapse starts), stay visible so
     the grid row height can animate closed instead of snapping. */
  overflow: ${p => (p.$overflowClip ? 'hidden' : 'visible')};

  ${p =>
    p.$standaloneBottomBorder &&
    css`
      border-bottom: 1px solid ${p.theme.tokens.border.primary};
    `}

  &[data-expanded] ${FloatingPanel} {
    grid-template-rows: 1fr;
  }

  &[data-expanded] ${Inner} {
    padding-top: 1px;
  }
`;

/**
 * Attach returned `containerProps` to the Explore search region (e.g. `ExploreBodySearch`)
 * so hovering or focusing anywhere in that region expands the schema hints strip.
 */
export function useSchemaHintsExpansion() {
  const [isHovered, setIsHovered] = useState(false);
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [schemaHintsDrawerOpen, setSchemaHintsDrawerOpen] = useState(false);
  const {hoverProps} = useHover({onHoverChange: setIsHovered});
  const {focusWithinProps} = useFocusWithin({onFocusWithinChange: setIsFocusWithin});

  const interactionExpanded = isHovered || isFocusWithin;

  return {
    containerProps: mergeProps(hoverProps, focusWithinProps),
    isExpanded: interactionExpanded || schemaHintsDrawerOpen,
    onHintsDrawerToggle: setSchemaHintsDrawerOpen,
  };
}

interface SchemaHintsSectionProps extends PropsWithChildren {
  isExpanded: boolean;
  /**
   * When true, draws a collapsed bottom border on this strip (for layouts without
   * {@link ExploreBodySearch}'s full-width border). Default false so we do not double
   * the line under sticky Explore chrome.
   */
  standaloneBottomBorder?: boolean;
}

/**
 * Wraps schema hints: collapsed by default (minimal layout height), expands when
 * `isExpanded` is true (typically the `isExpanded` value from {@link useSchemaHintsExpansion}).
 * The expanded panel is absolutely positioned so it overlays content below instead of
 * pushing the layout.
 */
export function SchemaHintsSection({
  children,
  isExpanded,
  standaloneBottomBorder = false,
}: SchemaHintsSectionProps) {
  const [overflowClip, setOverflowClip] = useState(!isExpanded);

  useEffect(() => {
    if (isExpanded) {
      setOverflowClip(false);
      return;
    }
    const id = window.setTimeout(
      () => setOverflowClip(true),
      SCHEMA_HINTS_GRID_TRANSITION_MS
    );
    return () => window.clearTimeout(id);
  }, [isExpanded]);

  return (
    <Wrapper
      $overflowClip={overflowClip}
      $standaloneBottomBorder={standaloneBottomBorder}
      data-schema-hints-section
      data-expanded={isExpanded ? '' : undefined}
    >
      <FloatingPanel>
        <Inner>{children}</Inner>
      </FloatingPanel>
    </Wrapper>
  );
}
