import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';

/**
 * Required rather than optional, so a stat with nothing to show is written on
 * purpose as `null`, never arrived at by leaving the value out.
 */
type EntityHeaderStatValue = number | string | null;

/**
 * One half of a stat — its label or its value. Each half declares what it is,
 * rather than the component inferring it from whether a destination happens
 * to be defined. The content may change as often as it likes; the type may
 * not, so a link half stays a link when its count is zero or empty.
 */
type EntityHeaderStatPart<TContent> = {
  content: TContent;
  /**
   * Takes structured content as readily as a string, so it can be built from
   * `Tooltip.Header`, `Tooltip.Grid` and `Tooltip.Row`. Keep it readable
   * without links: nothing inside a tooltip can be reached by keyboard.
   */
  tooltip?: React.ReactNode;
} & (
  | {type: 'text'}
  | ({
      type: 'link';
      onClick?: () => void;
    } & LinkDestination)
);

export interface EntityHeaderStatProps {
  /**
   * Short, static label such as "Dead Clicks". A string is shorthand for a
   * `text` label.
   *
   * Link the label when the destination is about what the stat measures —
   * the tab where dead clicks are listed. Its tooltip explains a label that is
   * jargon on its own.
   */
  label: string | EntityHeaderStatPart<string>;
  /**
   * The measurement itself. Text, not a node: the row is built for single
   * numbers, and any breakdown belongs in the value's `tooltip`. A number,
   * string or `null` is shorthand for a `text` value.
   *
   * Link the value when the destination is the things it counts — the errors
   * behind an error count. Its tooltip carries what the value is made of, or,
   * when the content is `null`, why there is none.
   *
   * `null` means the data was never collected for this entity — no cost
   * recorded, no size reported. It renders a "—" and is read "No data". Never
   * pass a placeholder such as `'-'` or `'—'` yourself: a screen reader reads it
   * aloud as the data ("dash").
   *
   * Not for a real zero (pass `0`), a value still loading (pass `isLoading`),
   * or a stat that does not apply to this entity (pass `null` for the whole
   * item instead).
   */
  value: EntityHeaderStatValue | EntityHeaderStatPart<EntityHeaderStatValue>;
  /**
   * Hold this one stat as a skeleton while the rest of the header is live. Use
   * it when the value comes from a request that settles after the entity does;
   * without it a stat renders whatever it has, which asserts a zero before the
   * real count lands. Independent of, and additive to, the header's own
   * `isLoading`.
   */
  isLoading?: boolean;
}

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

function getLabelPart(
  label: EntityHeaderStatProps['label']
): EntityHeaderStatPart<string> {
  return typeof label === 'string' ? {type: 'text', content: label} : label;
}

function getValuePart(
  value: EntityHeaderStatProps['value']
): EntityHeaderStatPart<EntityHeaderStatValue> {
  return value !== null && typeof value === 'object'
    ? value
    : {type: 'text', content: value};
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

function StatPart({
  part,
  children,
  styles,
  textVariant,
}: {
  children: React.ReactNode;
  part: EntityHeaderStatPart<EntityHeaderStatValue>;
  styles: typeof LABEL_STYLES | typeof VALUE_STYLES;
  textVariant?: 'muted';
}) {
  if (part.type === 'link') {
    // Named by its own text. The other half is read in the same list item,
    // which is context enough for the link's purpose.
    return (
      <Text {...styles} variant="accent">
        {styleProps => {
          const link =
            part.externalHref === undefined ? (
              <Link to={part.to} onClick={part.onClick} {...styleProps}>
                {children}
              </Link>
            ) : (
              <ExternalLink
                href={part.externalHref}
                onClick={part.onClick}
                {...styleProps}
              >
                {children}
              </ExternalLink>
            );
          // The tooltip attaches to the link rather than wrapping it in
          // InfoText, which would put a second tab stop inside the anchor.
          return part.tooltip ? (
            <Tooltip title={part.tooltip} skipWrapper showUnderline>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  }

  if (part.tooltip) {
    return (
      <InfoText title={part.tooltip} variant={textVariant} {...styles}>
        {children}
      </InfoText>
    );
  }

  return (
    <Text variant={textVariant} {...styles}>
      {children}
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

  const label = getLabelPart(props.label);
  const value = getValuePart(props.value);
  const isEmpty = value.content === null;

  warnOnPlaceholderValue(label.content, value.content);

  return (
    <Flex as="li" align="center" height={ROW_HEIGHT} flexShrink={0} minWidth={0}>
      {/*
        The label comes first, on screen and in the DOM, so a number is never
        read before what it counts. Each half is read as itself: "Errors",
        then "3".
      */}
      <Flex align="baseline" gap="xs" minWidth={0}>
        <StatPart part={label} styles={LABEL_STYLES} textVariant="muted">
          {label.content}
        </StatPart>
        {/*
          An empty value keeps the value's typography, so the row's height and
          baseline do not move, and is muted so it does not read as a
          measurement — unless it links, where the colour says it navigates.
        */}
        <StatPart
          part={value}
          styles={VALUE_STYLES}
          textVariant={isEmpty ? 'muted' : undefined}
        >
          {isEmpty ? <EmptyValue /> : value.content}
        </StatPart>
      </Flex>
    </Flex>
  );
}
