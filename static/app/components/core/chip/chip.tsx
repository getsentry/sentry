import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text, type TextProps} from '@sentry/scraps/text';
import {useTranslation} from '@sentry/scraps/translationContext';

import {IconClose} from 'sentry/icons';

/**
 * How focus is managed across the chip's interactive sections.
 * - `auto` (default): the chip owns a roving tabindex — a single tab stop
 *   enters the chip and Arrow/Home/End move between sections. Use standalone.
 * - `manual`: the chip sets no tabindex and installs no key handling; each
 *   section defers entirely to caller-supplied props. Use when an outer system
 *   (e.g. the search query builder grid) already manages focus.
 */
type ChipFocus = 'auto' | 'manual';

const SIZES = {
  xs: {height: '20px', radius: '2xs', pad: 'xs', font: 'sm', dismiss: '20px'},
  sm: {height: '24px', radius: 'xs', pad: 'sm', font: 'md', dismiss: '20px'},
  md: {height: '28px', radius: 'sm', pad: 'md', font: 'md', dismiss: '24px'},
} as const;

type ChipSize = keyof typeof SIZES;

const SEGMENT_ATTR = 'data-chip-segment';

type ChipSegmentProps = React.HTMLAttributes<HTMLElement> & {
  [SEGMENT_ATTR]?: '';
};

interface RovingController {
  activeId: string | null;
  enabled: boolean;
  getItemProps: (id: string) => ChipSegmentProps;
  register: (id: string) => () => void;
}

interface ChipContextValue {
  readonly: boolean;
  roving: RovingController;
  size: ChipSize;
}

const ChipContext = createContext<ChipContextValue | null>(null);

function useChipContext(component: string): ChipContextValue {
  const context = useContext(ChipContext);
  if (!context) {
    throw new Error(`${component} must be rendered inside <Chip.Root>`);
  }
  return context;
}

/**
 * Roving-tabindex controller for the chip's interactive sections.
 *
 * The first registered section becomes the single tab stop; Arrow/Home/End
 * move focus between the sections that are actually in the DOM (queried live so
 * order stays correct regardless of registration order). When `enabled` is
 * false (manual focus mode) it becomes inert and yields no props.
 */
function useRovingController(
  enabled: boolean,
  rootRef: React.RefObject<HTMLDivElement | null>
): RovingController {
  const idsRef = useRef<string[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const register = useCallback((id: string) => {
    if (!idsRef.current.includes(id)) {
      idsRef.current = [...idsRef.current, id];
    }
    setActiveId(current => current ?? id);

    return () => {
      idsRef.current = idsRef.current.filter(existing => existing !== id);
      setActiveId(current => (current === id ? (idsRef.current[0] ?? null) : current));
    };
  }, []);

  const onItemKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      const root = rootRef.current;
      if (!root) {
        return;
      }

      const items = Array.from(root.querySelectorAll<HTMLElement>(`[${SEGMENT_ATTR}]`));
      const currentIndex = items.indexOf(event.currentTarget);
      if (currentIndex === -1) {
        return;
      }

      let nextIndex = -1;
      switch (event.key) {
        case 'ArrowRight':
          nextIndex = (currentIndex + 1) % items.length;
          break;
        case 'ArrowLeft':
          nextIndex = (currentIndex - 1 + items.length) % items.length;
          break;
        case 'Home':
          nextIndex = 0;
          break;
        case 'End':
          nextIndex = items.length - 1;
          break;
        default:
          return;
      }

      event.preventDefault();
      items[nextIndex]?.focus();
    },
    [rootRef]
  );

  const getItemProps = useCallback(
    (id: string): ChipSegmentProps => ({
      [SEGMENT_ATTR]: '',
      tabIndex: activeId === id ? 0 : -1,
      onFocus: () => setActiveId(id),
      onKeyDown: onItemKeyDown,
    }),
    [activeId, onItemKeyDown]
  );

  return useMemo(
    () => ({enabled, activeId, register, getItemProps}),
    [enabled, activeId, register, getItemProps]
  );
}

/**
 * Wires a section into the chip's roving-tabindex when it is interactive and the
 * chip is in `roving` focus mode. Returns the props to spread onto the focusable
 * element (empty in manual mode or for inert sections).
 */
function useChipSegment(interactive: boolean): ChipSegmentProps {
  const {roving} = useChipContext('Chip section');
  // `register` is stable, but the roving object identity changes whenever the
  // active tab stop moves. Depend only on `register` so the registration effect
  // runs on mount/unmount — not on every focus change, which would otherwise
  // unregister the focused section and reset the tab stop to the first one.
  const {enabled, register, getItemProps} = roving;
  const id = useId();
  const active = interactive && enabled;

  useEffect(() => {
    if (active) {
      return register(id);
    }
    return;
  }, [active, id, register]);

  return active ? getItemProps(id) : {};
}

interface ChipRootProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /**
   * @default 'auto'
   */
  focus?: ChipFocus;
  /**
   * Renders a non-interactive summary: interactive sections fall back to inert
   * text and the dismiss affordance is suppressed.
   */
  readonly?: boolean;
  size?: ChipSize;
}

/**
 * The chonky-embossed container. Owns `size`, `readonly`, and focus management
 * for the sections composed inside it.
 */
function ChipRoot({
  size = 'md',
  readonly = false,
  focus = 'auto',
  children,
  ...rest
}: ChipRootProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const roving = useRovingController(!readonly && focus === 'auto', rootRef);

  const context = useMemo<ChipContextValue>(
    () => ({size, readonly, roving}),
    [size, readonly, roving]
  );

  return (
    <ChipContext.Provider value={context}>
      <ChipRootElement ref={rootRef} chipSize={size} {...rest}>
        {children}
      </ChipRootElement>
    </ChipContext.Provider>
  );
}

type SectionTone = 'property' | 'operator' | 'value';

interface ChipSectionProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  children: React.ReactNode;
  /**
   * Force interactive (button) rendering even without an `onClick`. Interactive
   * is otherwise inferred from the presence of `onClick`.
   */
  interactive?: boolean;
  ref?: React.Ref<HTMLButtonElement>;
  /**
   * Overrides the default text color for the section.
   */
  variant?: TextProps<'span'>['variant'];
}

function resolveTone(tone: SectionTone, readonly: boolean): TextProps<'span'>['variant'] {
  if (tone === 'operator') {
    return 'secondary';
  }
  if (tone === 'value') {
    return readonly ? 'secondary' : 'accent';
  }
  return 'primary';
}

function ChipSection({
  tone,
  children,
  variant,
  interactive,
  onClick,
  ref,
  ...rest
}: ChipSectionProps & {tone: SectionTone}) {
  const {size, readonly} = useChipContext('Chip section');
  const isInteractive = !readonly && (interactive ?? onClick !== undefined);
  const segmentProps = useChipSegment(isInteractive);
  const textVariant = variant ?? resolveTone(tone, readonly);
  const textSize = SIZES[size].font;

  const content = (
    <Text size={textSize} variant={textVariant} wrap="nowrap">
      {children}
    </Text>
  );

  if (!isInteractive) {
    return (
      <Flex display="inline-flex" align="center">
        {content}
      </Flex>
    );
  }

  return (
    <InteractiveSegment
      ref={ref}
      type="button"
      data-chip-interactive=""
      // `segmentProps` comes last so the roving-managed tabIndex/handlers stay
      // authoritative over any caller-supplied `tabIndex`. In manual mode
      // `segmentProps` is empty, so caller props win there instead.
      {...mergeProps(rest, segmentProps, {onClick})}
    >
      {content}
    </InteractiveSegment>
  );
}

/**
 * The filter key, shown first. Becomes a button when given an `onClick`.
 */
function ChipProperty(props: ChipSectionProps) {
  return <ChipSection tone="property" {...props} />;
}

/**
 * The comparison operator (e.g. `is`). Becomes a button when given an `onClick`.
 */
function ChipOperator(props: ChipSectionProps) {
  return <ChipSection tone="operator" {...props} />;
}

/**
 * The filter value. Becomes a button when given an `onClick`.
 */
function ChipValue(props: ChipSectionProps) {
  return <ChipSection tone="value" {...props} />;
}

interface ChipDismissProps extends Omit<
  React.ButtonHTMLAttributes<HTMLButtonElement>,
  'children'
> {
  ref?: React.Ref<HTMLButtonElement>;
}

/**
 * The trailing ✕ button. Suppressed when the chip is `readonly`. Clicks are kept
 * from bubbling so removing a chip does not also trigger click handlers on the
 * chip itself or an ancestor (e.g. click-to-edit).
 */
function ChipDismiss({onClick, ref, ...rest}: ChipDismissProps) {
  const {t} = useTranslation();
  const {size, readonly} = useChipContext('Chip.Dismiss');
  const segmentProps = useChipSegment(!readonly);

  if (readonly) {
    return null;
  }

  return (
    <DismissButton
      ref={ref}
      chipSize={size}
      size="zero"
      variant="transparent"
      icon={<IconClose size="xs" />}
      aria-label={t('Remove')}
      data-chip-dismiss=""
      {...mergeProps(rest, segmentProps, {
        onClick: (event: React.MouseEvent<HTMLButtonElement>) => {
          event.stopPropagation();
          onClick?.(event);
        },
      })}
    />
  );
}

interface BaseFlatChipProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
  /**
   * The comparison operator shown between property and value (e.g. `is`).
   */
  operator?: string;
  /**
   * The filter key, shown first.
   */
  property?: string;
  size?: ChipSize;
}

interface DismissableFlatChipProps extends BaseFlatChipProps {
  /**
   * Called when the dismiss affordance is activated. Providing it renders a
   * trailing ✕ button; omit it for a static chip.
   */
  onDismiss?: () => void;
  readonly?: false;
}

interface ReadonlyFlatChipProps extends BaseFlatChipProps {
  /**
   * Renders a non-interactive summary: the value reads as secondary and the
   * dismiss affordance is suppressed. Readonly chips cannot be dismissed.
   */
  readonly: true;
  onDismiss?: never;
}

type FlatChipProps = DismissableFlatChipProps | ReadonlyFlatChipProps;

/**
 * A compact, chonky-embossed token for search filters and standalone values.
 *
 * The flat form renders `property operator value` or a lone `value` from
 * strings — presentation only, no interaction. For per-section interaction
 * (click-to-edit, remove), compose the primitives directly:
 *
 * ```tsx
 * <Chip.Root size="sm">
 *   <Chip.Property onClick={editKey}>{key}</Chip.Property>
 *   <Chip.Operator onClick={editOperator}>{operator}</Chip.Operator>
 *   <Chip.Value onClick={editValue}>{value}</Chip.Value>
 *   <Chip.Dismiss onClick={remove} />
 * </Chip.Root>
 * ```
 */
export function Chip({
  size = 'md',
  property,
  operator,
  readonly = false,
  value,
  onDismiss,
  ...rest
}: FlatChipProps) {
  const {t} = useTranslation();
  const valueVariant = readonly
    ? 'secondary'
    : property === undefined
      ? 'primary'
      : 'accent';

  return (
    <ChipRoot size={size} readonly={readonly} {...rest}>
      {property !== undefined && <ChipProperty>{property}</ChipProperty>}
      {operator ? <ChipOperator>{operator}</ChipOperator> : null}
      <ChipValue variant={valueVariant}>{value}</ChipValue>
      {!readonly && onDismiss ? (
        <ChipDismiss
          aria-label={t(
            'Remove %s',
            [property, operator, value].filter(Boolean).join(' ')
          )}
          onClick={() => onDismiss()}
        />
      ) : null}
    </ChipRoot>
  );
}

Chip.Root = ChipRoot;
Chip.Property = ChipProperty;
Chip.Operator = ChipOperator;
Chip.Value = ChipValue;
Chip.Dismiss = ChipDismiss;

const ChipRootElement = styled('div')<{chipSize: ChipSize}>`
  display: inline-flex;
  align-items: stretch;
  box-sizing: border-box;
  height: ${p => SIZES[p.chipSize].height};
  /* Inert layout: generous end padding, tight gap between the value parts. */
  gap: ${p => p.theme.space.xs};
  padding-inline: ${p => p.theme.space[SIZES[p.chipSize].pad]};
  border: 1px solid ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  border-radius: ${p => p.theme.radius[SIZES[p.chipSize].radius]};
  background: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.background};
  box-shadow: 0 1px 0 0 ${p => p.theme.tokens.interactive.chonky.embossed.neutral.chonk};
  line-height: 16px;

  /* Let the trailing dismiss button sit flush against the edge. */
  &:has([data-chip-dismiss]) {
    padding-right: 0;
  }
  /*
   * The dismiss button's own inline padding already supplies the flat gap
   * on this seam (see DismissButton below), so cancel out the inert
   * layout's uniform gap here rather than doubling it. Only applies when
   * there are no interactive segments — that layout redistributes this
   * seam's spacing itself, below.
   */
  &:not(:has([data-chip-interactive])) > [data-chip-dismiss] {
    margin-inline-start: calc(-1 * ${p => p.theme.space.xs});
  }

  /*
   * Interactive layout: segmented buttons abut and fill the chip. Redistribute
   * padding so labels line up exactly with the flat chip — the flat end padding
   * on the outer edges and half the flat gap on each inner seam, so adjacent
   * segments sum to a single gap instead of doubling.
   */
  &:has([data-chip-interactive]) {
    gap: 0;
    padding-inline: 0;
  }
  &:has([data-chip-interactive]) [data-chip-interactive] {
    padding-inline: calc(${p => p.theme.space.xs} / 2);
  }
  &:has([data-chip-interactive]) > [data-chip-interactive]:first-child {
    padding-inline-start: ${p => p.theme.space[SIZES[p.chipSize].pad]};
  }
  &:has([data-chip-interactive]) > [data-chip-interactive]:last-child {
    padding-inline-end: ${p => p.theme.space[SIZES[p.chipSize].pad]};
  }
  /*
   * A segment flush against the dismiss yields its half of the seam — the
   * dismiss button's own inline padding (see DismissButton below) supplies
   * the single flat gap, same as the inert layout above.
   */
  &:has([data-chip-interactive]) > [data-chip-interactive]:has(+ [data-chip-dismiss]) {
    padding-inline-end: 0;
  }

  /*
   * Overflow stays visible so a segment's focus ring isn't clipped. Round the
   * leading and trailing children instead, so their hover/active backgrounds
   * still follow the chip's corners in the flush interactive layout. The inner
   * radius is the chip radius minus the 1px border so the corners stay
   * concentric with the chip.
   */
  & > :first-child {
    border-start-start-radius: calc(
      ${p => p.theme.radius[SIZES[p.chipSize].radius]} - 1px
    );
    border-end-start-radius: calc(${p => p.theme.radius[SIZES[p.chipSize].radius]} - 1px);
  }
  & > :last-child {
    border-start-end-radius: calc(${p => p.theme.radius[SIZES[p.chipSize].radius]} - 1px);
    border-end-end-radius: calc(${p => p.theme.radius[SIZES[p.chipSize].radius]} - 1px);
  }
`;

const InteractiveSegment = styled('button')`
  display: inline-flex;
  align-items: center;
  align-self: stretch;
  margin: 0;
  border: 0;
  background: ${p => p.theme.tokens.interactive.transparent.neutral.background.rest};
  padding: 0;
  color: inherit;
  cursor: pointer;

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }

  &:focus-visible {
    ${p => p.theme.focusRing()};
    z-index: 1;
  }
`;

const DismissButton = styled(Button)<{chipSize: ChipSize}>`
  align-self: stretch;
  width: ${p => SIZES[p.chipSize].dismiss};
  height: auto;
  min-height: 0;
  padding: 0 ${p => p.theme.space.xs};
  border: 0;
  border-radius: 0;
  color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.secondary};

  &:hover {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.hover};
    color: ${p => p.theme.tokens.interactive.chonky.embossed.neutral.content.primary};
  }

  &:active {
    background: ${p => p.theme.tokens.interactive.transparent.neutral.background.active};
  }
`;
