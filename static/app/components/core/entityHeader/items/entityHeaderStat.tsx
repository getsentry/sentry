import {ROW_HEIGHT, STAT_VALUE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';

export interface EntityHeaderStatProps {
  /**
   * Short, static label such as "Dead Clicks". Never skeletonised — it is known
   * before the data arrives, so showing it immediately keeps the row stable.
   */
  label: string;
  /**
   * The measurement itself. Accepts a node so rich values (an error count with
   * platform icons, a viewer avatar list) fit without a second component.
   */
  value: React.ReactNode;
  /**
   * Decorative 12x12 graphic rendered before the value.
   */
  icon?: React.ReactNode;
  /**
   * Width of the skeleton shown in place of `value` while loading.
   */
  loadingWidth?: string;
  onClick?: () => void;
  /**
   * Turns the value into a link.
   */
  to?: LinkProps['to'];
}

export function EntityHeaderStat({
  icon,
  isLoading,
  label,
  loadingWidth = '24px',
  onClick,
  to,
  value,
}: EntityHeaderStatProps & {isLoading?: boolean}) {
  const valueText = (
    <Text size="lg" bold tabular wrap="nowrap">
      {value}
    </Text>
  );

  return (
    // The outer box is a fixed height so the row cannot resize as async values
    // land — a viewer avatar list and an error count are both taller than the
    // text they replace, and each one settling would otherwise shift the rows
    // below. Content is centred inside it rather than growing it.
    <Flex align="center" height={ROW_HEIGHT} flexShrink={0} minWidth={0}>
      {/*
        `baseline` is what makes the value and its label sit on a shared line,
        which is the visual signature of the stat row.
      */}
      <Flex align="baseline" gap="xs" minWidth={0}>
        {icon && !isLoading && (
          <Flex align="center" flexShrink={0} aria-hidden>
            {icon}
          </Flex>
        )}
        {isLoading ? (
          <Placeholder width={loadingWidth} height={STAT_VALUE_HEIGHT} />
        ) : to ? (
          <Link to={to} onClick={onClick}>
            {valueText}
          </Link>
        ) : (
          valueText
        )}
        <Text size="sm" bold variant="muted" density="comfortable" wrap="nowrap">
          {label}
        </Text>
      </Flex>
    </Flex>
  );
}
