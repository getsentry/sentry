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

function StatValue(props: EntityHeaderStatProps) {
  if (props.type === 'text' && props.valueTooltip) {
    return (
      <InfoText title={props.valueTooltip} {...VALUE_STYLES}>
        {props.value}
      </InfoText>
    );
  }

  // Hidden on a link stat, where the anchor's own name already speaks it.
  return (
    <Text aria-hidden={props.type === 'link'} {...VALUE_STYLES}>
      {props.value}
    </Text>
  );
}

function StatLabel(props: EntityHeaderStatProps) {
  const {label, labelTooltip} = props;

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
      <InfoText title={labelTooltip} variant="muted" {...LABEL_STYLES}>
        {label}
      </InfoText>
    );
  }

  return (
    <Text {...LABEL_STYLES} variant="muted">
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

  return (
    <Flex as="li" align="center" height={ROW_HEIGHT} flexShrink={0} minWidth={0}>
      {/*
        A stat is one fact split across two elements, which a screen reader
        moving element by element reads as two: "0", then "link, Dead Clicks".
        On a link stat the anchor is named from both, so it reads "0 Dead
        Clicks" in one go.
      */}
      <Flex align="baseline" gap="xs" minWidth={0}>
        <StatValue {...props} />
        <StatLabel {...props} />
      </Flex>
    </Flex>
  );
}
