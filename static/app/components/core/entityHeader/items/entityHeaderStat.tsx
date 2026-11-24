import {Fragment} from 'react';
import {VisuallyHidden} from '@react-aria/visually-hidden';

import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import type {LinkDestination} from '@sentry/scraps/link';
import {useTranslation} from '@sentry/scraps/translation/useTranslation';

import {Placeholder} from 'sentry/components/placeholder';

import type {
  EntityHeaderTextBehavior,
  EntityHeaderTextTypography,
} from './entityHeaderText';
import {EntityHeaderText} from './entityHeaderText';

/**
 * Required rather than optional, so a stat with nothing to show is passed as
 * `null` on purpose, not by leaving the value out.
 */
type EntityHeaderStatValue = number | string | null;

/**
 * How one half of a stat behaves, separate from what it shows. Each half
 * declares its type rather than the component inferring it from whether a
 * destination is defined. The content can change, but the type should not, so
 * a link half stays a link when its count is zero or empty.
 */
type EntityHeaderStatPartBehavior = EntityHeaderStatPartTooltip &
  (EntityHeaderStatTextBehavior | EntityHeaderStatLinkBehavior);

type EntityHeaderStatPartTooltip = {
  /**
   * A string, or content built from `Tooltip.Header`, `Tooltip.Grid` and
   * `Tooltip.Row`. Don't rely on links inside it, because nothing inside a
   * tooltip can be reached by keyboard.
   */
  tooltip?: React.ReactNode;
};

type EntityHeaderStatTextBehavior = {type: 'text'};

type EntityHeaderStatLinkBehavior = {
  type: 'link';
  onClick?: () => void;
} & LinkDestination;

/**
 * One half of a stat, either its label or its value, with its content and
 * behavior.
 */
type EntityHeaderStatPart<TContent> = {content: TContent} & EntityHeaderStatPartBehavior;

export interface EntityHeaderStatProps {
  /**
   * Short, static label such as "Dead Clicks". A string is shorthand for a
   * `text` label.
   *
   * Link the label when the destination is about what the stat measures, such
   * as the tab that lists dead clicks. Use its tooltip to explain jargon.
   */
  label: string | EntityHeaderStatPart<string>;
  /**
   * The measurement. A number or string rather than a node, because the row
   * shows single numbers and any breakdown belongs in the value's `tooltip`. A
   * number, string or `null` is shorthand for a `text` value.
   *
   * Link the value when the destination is the things it counts, such as the
   * errors behind an error count. Its tooltip shows what the value is made of
   * or, when the content is `null`, why there is none.
   *
   * `null` means the data was never collected for this entity, such as a build
   * with no recorded cost. It renders a "—" and is read as "No data". Never
   * pass a placeholder such as `'-'` or `'—'`, because a screen reader reads it
   * aloud as the data ("dash").
   *
   * Don't use `null` for a real zero (pass `0`), a value still loading (pass
   * `isLoading`) or a stat that does not apply to this entity (pass `null` for
   * the whole item).
   */
  value: EntityHeaderStatValue | EntityHeaderStatPart<EntityHeaderStatValue>;
  /**
   * Shows this stat as a skeleton after the rest of the header has loaded. Use
   * it when the value comes from a request that finishes after the entity's.
   * Without it, the stat renders whatever it holds, often a `0` before the
   * real count arrives. Applies in addition to the header's `isLoading`.
   */
  isLoading?: boolean;
}

const STAT_PART_STYLES = {
  label: {size: 'sm', bold: true, density: 'comfortable', wrap: 'nowrap'},
  value: {size: 'lg', bold: true, tabular: true, wrap: 'nowrap'},
} as const satisfies Record<'label' | 'value', EntityHeaderTextTypography>;

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

function muteText(
  behavior: EntityHeaderStatPartBehavior,
  muted: boolean
): EntityHeaderTextBehavior {
  return behavior.type === 'text' && muted ? {...behavior, variant: 'muted'} : behavior;
}

function EmptyValue() {
  const {t} = useTranslation();
  // Translators: read by a screen reader in place of the dash shown for a stat that has nothing to show, such as a build with no recorded cost
  const noData = t('No data');

  // The dash is hidden from screen readers, which would read it as "dash" and
  // make it sound like a value.
  return (
    <Fragment>
      <span aria-hidden>{EMPTY_VALUE}</span>
      <VisuallyHidden elementType="span">{noData}</VisuallyHidden>
    </Fragment>
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
        <EntityHeaderText {...STAT_PART_STYLES.label} behavior={muteText(label, true)}>
          {label.content}
        </EntityHeaderText>
        {/*
          An empty value keeps the value's typography, so the row's height and
          baseline do not move. It is muted so it does not look like a
          measurement, unless it is a link, which stays accent to show it
          navigates.
        */}
        <EntityHeaderText {...STAT_PART_STYLES.value} behavior={muteText(value, isEmpty)}>
          {isEmpty ? <EmptyValue /> : value.content}
        </EntityHeaderText>
      </Flex>
    </Flex>
  );
}
