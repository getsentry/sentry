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
   * The measurement itself. Text, not a node: the row is built for single
   * numbers, and any breakdown belongs in `valueTooltip`.
   */
  value: number | string;
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
  /**
   * What the value is made of — the projects behind an error count, say.
   * Takes structured content, which is how a breakdown stays out of the row.
   */
  valueTooltip?: React.ReactNode;
}

/**
 * A stat declares what it is, rather than the component inferring it from
 * whether a destination happens to be defined. The value may change as often
 * as it likes; the type may not.
 */
export type EntityHeaderStatProps =
  | ({type: 'text'} & EntityHeaderStatBase)
  | ({
      /**
       * Where the label leads. Required, so the stat cannot quietly stop being
       * a link when its count is zero.
       */
      to: LinkProps['to'];
      type: 'link';
      onClick?: () => void;
    } & EntityHeaderStatBase);

const VALUE_STYLES = {size: 'lg', bold: true, tabular: true, wrap: 'nowrap'} as const;

const LABEL_STYLES = {
  size: 'sm',
  bold: true,
  density: 'comfortable',
  wrap: 'nowrap',
} as const;

function StatValue({value, valueTooltip}: EntityHeaderStatProps) {
  if (valueTooltip) {
    return (
      <InfoText title={valueTooltip} {...VALUE_STYLES}>
        {value}
      </InfoText>
    );
  }

  return <Text {...VALUE_STYLES}>{value}</Text>;
}

function StatLabel(props: EntityHeaderStatProps) {
  const {label, labelTooltip} = props;

  if (props.type === 'link') {
    const {to, onClick} = props;
    // Named by its label alone — where it leads. The count beside it is read
    // in the same list item, which is context enough for the link's purpose.
    return (
      <Text {...LABEL_STYLES} variant="accent">
        {styleProps => {
          const link = (
            <Link to={to} onClick={onClick} {...styleProps}>
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
        The label comes first, on screen and in the DOM, so a number is never
        read before what it counts. Each half is read as itself: "Errors",
        then "3".
      */}
      <Flex align="baseline" gap="xs" minWidth={0}>
        <StatLabel {...props} />
        <StatValue {...props} />
      </Flex>
    </Flex>
  );
}
