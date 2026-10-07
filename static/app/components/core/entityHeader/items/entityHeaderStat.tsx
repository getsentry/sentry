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
   * What the stat measures, for a label that is jargon on its own. Takes
   * structured content as readily as a string, so it can be built from
   * `Tooltip.Header`, `Tooltip.Grid` and `Tooltip.Row`.
   */
  labelTooltip?: React.ReactNode;
  /**
   * Width of the skeleton that replaces the whole stat while loading. Size it to
   * the content you expect, so the row does not jump when the value lands.
   */
  loadingWidth?: string;
}

/**
 * A stat declares what it is, rather than the component inferring it from
 * whether a destination happens to be defined.
 *
 * This matters at runtime, not just for readability: a stat whose type depended
 * on its data would render a different element once that data arrived, and
 * swapping a span for an anchor mid-load moves the row. The value may change as
 * often as it likes; the type may not.
 */
export type EntityHeaderStatProps =
  | ({
      type: 'text';
      /**
       * The measurement itself. Keep it to the single number the label names,
       * and put any breakdown in `valueTooltip` — a stat that renders its own
       * detail inline fights the density the row is built for.
       */
      value: React.ReactNode;
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

export function EntityHeaderStat(props: EntityHeaderStatProps & {isLoading?: boolean}) {
  const {isLoading, label, labelTooltip, loadingWidth = '80px', value} = props;
  // The whole stat becomes one skeleton, label included. The label is static and
  // could be shown immediately, but a half-drawn stat reads as broken next to a
  // title and metadata row that are still loading.
  if (isLoading) {
    return (
      <Flex align="center" height={ROW_HEIGHT} flexShrink={0}>
        <Placeholder width={loadingWidth} height={STAT_VALUE_HEIGHT} />
      </Flex>
    );
  }

  const valueStyles = {size: 'lg', bold: true, tabular: true, wrap: 'nowrap'} as const;

  // A stat is one fact split across two elements, which a screen reader moving
  // element by element reads as two: "0", then "link, Dead Clicks". On a link
  // stat the anchor is named from both, so it reads "0 Dead Clicks" in one go,
  // and the value is hidden since the name already speaks it.
  const isLink = props.type === 'link';
  const valueContent =
    props.type === 'text' && props.valueTooltip ? (
      <InfoText title={props.valueTooltip} {...valueStyles}>
        {value}
      </InfoText>
    ) : (
      <Text aria-hidden={isLink} {...valueStyles}>
        {value}
      </Text>
    );

  const labelStyles = {
    size: 'sm',
    bold: true,
    variant: 'muted',
    density: 'comfortable',
    wrap: 'nowrap',
  } as const;

  let labelContent: React.ReactNode;
  if (props.type === 'link') {
    const {to, onClick} = props;
    // The label is what navigates, so the link is named by what it leads to
    // rather than by a number. The dotted underline is the same treatment Issue
    // Details gives its stat links.
    //
    // The anchor carries the label's text styles rather than wrapping an element
    // that has them, the same way `BreadcrumbItemLink` styles its link. `Link`
    // emits `text-box-trim` but no font size, so wrapping would leave the anchor
    // trimmed to the font it inherits from the row rather than the stat's own.
    labelContent = (
      <Text {...labelStyles} underline="dotted">
        {styleProps => {
          const link = (
            <Link
              to={to}
              onClick={onClick}
              // Composed rather than assembled from the DOM with
              // `aria-labelledby`, which would have to reach into the hidden
              // value node — something not every engine is known to honour.
              aria-label={`${props.value} ${label}`}
              {...styleProps}
            >
              {label}
            </Link>
          );
          // The tooltip attaches to the link rather than wrapping it in
          // InfoText, which would put a second tab stop inside the anchor.
          return labelTooltip ? (
            <Tooltip title={labelTooltip} skipWrapper>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  } else if (labelTooltip) {
    labelContent = (
      <InfoText title={labelTooltip} {...labelStyles}>
        {label}
      </InfoText>
    );
  } else {
    labelContent = <Text {...labelStyles}>{label}</Text>;
  }

  return (
    // The outer box is a fixed height so the row cannot resize as async values
    // land — an error count settling is taller than the text it replaces, and
    // that would otherwise shift the rows below. Content is centred inside it
    // rather than growing it.
    <Flex align="center" height={ROW_HEIGHT} flexShrink={0} minWidth={0}>
      {/*
        `baseline` is what makes the value and its label sit on a shared line,
        which is the visual signature of the stat row.
      */}
      <Flex align="baseline" gap="xs" minWidth={0}>
        {valueContent}
        {labelContent}
      </Flex>
    </Flex>
  );
}
