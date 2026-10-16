import {VisuallyHidden} from '@react-aria/visually-hidden';

import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';

interface EntityHeaderStatBase {
  /**
   * Short, static label such as "Dead Clicks".
   */
  label: string;
  /**
   * Hold this one stat as a skeleton while the rest of the header is live. Use
   * it when the value comes from a request that settles after the entity does;
   * without it a stat renders whatever it has, which asserts a zero before the
   * real count lands. Independent of, and additive to, the header's own
   * `isLoading`.
   */
  isLoading?: boolean;
  /**
   * What the stat measures, for a label that is jargon on its own. Takes
   * structured content as readily as a string, so it can be built from
   * `Tooltip.Header`, `Tooltip.Grid` and `Tooltip.Row`.
   */
  labelTooltip?: React.ReactNode;
}

/**
 * A stat declares what it is, rather than the component inferring it from
 * whether a destination happens to be defined. The value may change as often
 * as it likes; the type may not.
 */
export type EntityHeaderStatProps =
  | ({
      type: 'text';
      /**
       * The measurement itself. Text, not a node: the row is built for single
       * numbers, and any breakdown belongs in `valueTooltip`.
       */
      value: number | string;
      /**
       * What the value is made of — the projects behind an error count, say.
       * Takes structured content, which is how a breakdown stays out of the row.
       *
       * Only on a text stat. On a link stat the value is hidden, since the link
       * speaks it as part of its own name, and a tooltip needs a visible,
       * focusable trigger — put the breakdown in `labelTooltip` instead, where
       * it attaches to the link.
       */
      valueTooltip?: React.ReactNode;
    } & EntityHeaderStatBase)
  | ({
      /**
       * Where the value leads. Required, so the stat cannot quietly stop being
       * a link when its count is zero.
       */
      to: LinkProps['to'];
      type: 'link';
      /**
       * Text, not a node, because the link is named from it. A graphic here
       * would leave the link named by its label alone, silently dropping the
       * half that says how many.
       */
      value: number | string;
      onClick?: () => void;
    } & EntityHeaderStatBase);

const VALUE_STYLES = {size: 'lg', bold: true, tabular: true, wrap: 'nowrap'} as const;

const LABEL_STYLES = {
  size: 'sm',
  bold: true,
  density: 'comfortable',
  wrap: 'nowrap',
} as const;

/**
 * Which node carries the stat's whole fact — "1.02 MB Download Size" — so it
 * is read in one go rather than as "1.02 MB", then "Download Size".
 *
 * A link has an anchor to put it on. A text stat has no such element, so the
 * name goes on whichever node a tooltip has already made focusable and the
 * other is hidden; with neither focusable, on a visually hidden node with both
 * visual ones hidden. Nothing focusable is ever hidden, which is why a stat
 * with a tooltip on *both* halves keeps its two separate announcements —
 * there is no node left that can be hidden safely.
 */
type StatNaming = 'anchor' | 'label' | 'value' | 'hidden' | 'split';

function getStatNaming(props: EntityHeaderStatProps): StatNaming {
  if (props.type === 'link') {
    return 'anchor';
  }

  const hasFocusableValue = Boolean(props.valueTooltip);
  const hasFocusableLabel = Boolean(props.labelTooltip);

  if (hasFocusableValue && hasFocusableLabel) {
    return 'split';
  }
  if (hasFocusableLabel) {
    return 'label';
  }
  if (hasFocusableValue) {
    return 'value';
  }
  return 'hidden';
}

interface StatNamingProps {
  composedName: string;
  naming: StatNaming;
}

function StatValue(props: EntityHeaderStatProps & StatNamingProps) {
  const {naming, composedName} = props;
  // Hidden wherever something else speaks it: the anchor, the label, or the
  // visually hidden node beside them.
  const isHidden = naming === 'anchor' || naming === 'label' || naming === 'hidden';

  if (props.type === 'text' && props.valueTooltip) {
    return (
      <InfoText
        title={props.valueTooltip}
        aria-label={naming === 'value' ? composedName : undefined}
        {...VALUE_STYLES}
      >
        {props.value}
      </InfoText>
    );
  }

  return (
    <Text aria-hidden={isHidden} {...VALUE_STYLES}>
      {props.value}
    </Text>
  );
}

function StatLabel(props: EntityHeaderStatProps & StatNamingProps) {
  const {label, labelTooltip, naming, composedName} = props;

  if (props.type === 'link') {
    const {to, onClick, value} = props;
    // The label is what navigates, so the link is named by what it leads to
    // rather than by a number.
    return (
      <Text {...LABEL_STYLES} variant="accent">
        {styleProps => {
          const link = (
            <Link
              to={to}
              onClick={onClick}
              // Composed rather than assembled from the DOM with
              // `aria-labelledby`, which would have to reach into the hidden
              // value node — something not every engine is known to honour.
              aria-label={`${value} ${label}`}
              {...styleProps}
            >
              {label}
            </Link>
          );
          // The tooltip attaches to the link rather than wrapping it in
          // InfoText, which would put a second tab stop inside the anchor.
          return labelTooltip ? (
            <Tooltip title={labelTooltip} skipWrapper showUnderline>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  }

  if (labelTooltip) {
    return (
      <InfoText
        title={labelTooltip}
        variant="muted"
        aria-label={naming === 'label' ? composedName : undefined}
        {...LABEL_STYLES}
      >
        {label}
      </InfoText>
    );
  }

  return (
    <Text aria-hidden={naming === 'hidden'} {...LABEL_STYLES} variant="muted">
      {label}
    </Text>
  );
}

export function EntityHeaderStat(props: EntityHeaderStatProps) {
  if (props.isLoading) {
    return (
      <Flex as="li" align="center" height={ROW_HEIGHT} flexShrink={0}>
        <Placeholder width="80px" height={STAT_VALUE_HEIGHT} />
      </Flex>
    );
  }

  const naming = getStatNaming(props);
  const composedName = `${props.value} ${props.label}`;

  return (
    <Flex as="li" align="center" height={ROW_HEIGHT} flexShrink={0} minWidth={0}>
      {/*
        A stat is one fact split across two elements, which a screen reader
        moving element by element would otherwise read as two: "0", then "link,
        Dead Clicks". Named from both, it reads "0 Dead Clicks" in one go.
      */}
      {naming === 'hidden' && <VisuallyHidden>{composedName}</VisuallyHidden>}
      <Flex align="baseline" gap="xs" minWidth={0}>
        <StatValue {...props} naming={naming} composedName={composedName} />
        <StatLabel {...props} naming={naming} composedName={composedName} />
      </Flex>
    </Flex>
  );
}
