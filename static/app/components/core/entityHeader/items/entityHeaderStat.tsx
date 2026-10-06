import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';

export interface EntityHeaderStatProps {
  /**
   * Short, static label such as "Dead Clicks".
   */
  label: string;
  /**
   * The measurement itself. Keep it to the single number the label names, and
   * put any breakdown in `valueTooltip` — a stat that renders its own detail
   * inline fights the density the row is built for.
   */
  value: React.ReactNode;
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
  onClick?: () => void;
  /**
   * Turns the value into a link.
   */
  to?: LinkProps['to'];
  /**
   * What the value is made of — the projects behind an error count, say. Takes
   * structured content, which is how a breakdown stays out of the row itself.
   */
  valueTooltip?: React.ReactNode;
}

export function EntityHeaderStat({
  isLoading,
  label,
  labelTooltip,
  loadingWidth = '80px',
  onClick,
  to,
  value,
  valueTooltip,
}: EntityHeaderStatProps & {isLoading?: boolean}) {
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

  let valueContent: React.ReactNode;
  if (to) {
    // The link takes the value's text styles rather than wrapping an element
    // that has them. `Link` sets `text-box-trim` but no font size, so as a flex
    // item it would trim itself to the font it inherits — not the stat's — and
    // the baseline would move the moment a link appeared. Styling the anchor
    // directly keeps one element, with one set of metrics, in every state.
    // It also keeps the value `content.primary`: a class beats the global
    // `a { color }` rule on specificity.
    valueContent = (
      <Text {...valueStyles}>
        {styleProps => {
          const link = (
            <Link to={to} onClick={onClick} {...styleProps}>
              {value}
            </Link>
          );
          // The tooltip attaches to the link rather than wrapping it in
          // InfoText, which would put a second tab stop inside the anchor, so
          // it has to draw the underline itself.
          return valueTooltip ? (
            <Tooltip title={valueTooltip} skipWrapper showUnderline>
              {link}
            </Tooltip>
          ) : (
            link
          );
        }}
      </Text>
    );
  } else if (valueTooltip) {
    valueContent = (
      <InfoText title={valueTooltip} {...valueStyles}>
        {value}
      </InfoText>
    );
  } else {
    valueContent = <Text {...valueStyles}>{value}</Text>;
  }

  const labelStyles = {
    size: 'sm',
    bold: true,
    variant: 'muted',
    density: 'comfortable',
    wrap: 'nowrap',
  } as const;

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
        {labelTooltip ? (
          <InfoText title={labelTooltip} {...labelStyles}>
            {label}
          </InfoText>
        ) : (
          <Text {...labelStyles}>{label}</Text>
        )}
      </Flex>
    </Flex>
  );
}
