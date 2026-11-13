import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';

/**
 * Required rather than optional, so a stat with nothing to show is written on
 * purpose as `null`, never arrived at by leaving the value out.
 */
type EntityHeaderStatValue = number | string | null;

interface EntityHeaderStatBase {
  /**
   * Short, static label such as "Dead Clicks".
   */
  label: string;
  /**
   * The measurement itself. Text, not a node: the row is built for single
   * numbers, and any breakdown belongs in `valueTooltip`.
   *
   * `null` means the stat applies to this entity but there is nothing to
   * show — no cost recorded, no size reported. It renders a muted "—" and is
   * read "No data". Never pass a placeholder such as `'-'` or `'—'` yourself:
   * a screen reader reads it aloud as the data ("dash").
   *
   * Not for a real zero (pass `0`), a value still loading (pass `isLoading`),
   * or a stat that does not apply to this entity (pass `null` for the whole
   * item instead). An empty link stat is still a link, named by its label,
   * since its type must not change once the data loads.
   */
  value: EntityHeaderStatValue;
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
   * What the value is made of — the projects behind an error count, say —
   * or, when `value` is `null`, why there is none. Takes structured content,
   * which is how a breakdown stays out of the row.
   *
   * Keep a reason readable without links: nothing inside a tooltip can be
   * reached by keyboard.
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

const EMPTY_VALUE = '\u2014';

const PLACEHOLDER_VALUES = new Set(['', '-', '\u2013', '\u2014', 'n/a', 'N/A']);

const warnedPlaceholderLabels = new Set<string>();

function warnOnPlaceholderValue(label: string, value: EntityHeaderStatValue): void {
  if (process.env.NODE_ENV === 'production') {
    return;
  }
  if (typeof value !== 'string' || !PLACEHOLDER_VALUES.has(value.trim())) {
    return;
  }
  if (warnedPlaceholderLabels.has(label)) {
    return;
  }
  warnedPlaceholderLabels.add(label);

  // eslint-disable-next-line no-console
  console.warn(
    `EntityHeader stat "${label}" was given the placeholder value "${value}", which a screen reader reads aloud as data. Pass \`value: null\` for a stat with nothing to show.`
  );
}

function EmptyValue() {
  const {t} = useTranslation();
  // Translators: read by a screen reader in place of the dash shown for a stat that has nothing to show, e.g. no cost recorded
  const noData = t('No data');

  // The dash is for the eye only; read aloud it would be "dash", which sounds
  // like a value.
  return (
    <Fragment>
      <span aria-hidden>{EMPTY_VALUE}</span>
      <VisuallyHidden elementType="span">{noData}</VisuallyHidden>
    </Fragment>
  );
}

function StatValue({value, valueTooltip}: EntityHeaderStatProps) {
  // An empty value keeps the value's typography, so the row's height and
  // baseline do not move, and is muted so it does not read as a measurement.
  const isEmpty = value === null;
  const content = isEmpty ? <EmptyValue /> : value;
  const variant = isEmpty ? 'muted' : undefined;

  if (valueTooltip) {
    return (
      <InfoText title={valueTooltip} variant={variant} {...VALUE_STYLES}>
        {content}
      </InfoText>
    );
  }

  return (
    <Text variant={variant} {...VALUE_STYLES}>
      {content}
    </Text>
  );
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

  warnOnPlaceholderValue(props.label, props.value);

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
