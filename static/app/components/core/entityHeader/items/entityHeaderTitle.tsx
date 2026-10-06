import {ROW_HEIGHT, TITLE_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {Flex} from '@sentry/scraps/layout';
import type {LinkProps} from '@sentry/scraps/link';
import {Link} from '@sentry/scraps/link';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Placeholder} from 'sentry/components/placeholder';

export interface EntityHeaderTitleProps {
  /**
   * The entity's name. Rendered as the page's `h2` — the `h1` belongs to the
   * TopBar title slot.
   */
  label: React.ReactNode;
  /**
   * Decorative 16x16 graphic — a `ProjectBadge`, avatar, or icon. Rendered
   * aria-hidden; the label carries the meaning.
   */
  leadingGraphic?: React.ReactNode;
  /**
   * Width of the skeleton shown while the header is loading.
   */
  loadingWidth?: string;
  /**
   * Status chips rendered inline after the label, e.g. `<Tag>Live</Tag>`.
   */
  tags?: React.ReactNode;
  /**
   * Turns the label into a link.
   */
  to?: LinkProps['to'];
  /**
   * Shown on hover. Use for a value the label abbreviates, such as a full UUID.
   */
  tooltip?: React.ReactNode;
}

export function EntityHeaderTitle({
  isLoading,
  label,
  leadingGraphic,
  loadingWidth = '240px',
  tags,
  to,
  tooltip,
}: EntityHeaderTitleProps & {isLoading?: boolean}) {
  if (isLoading) {
    return (
      <Flex align="center" minHeight={ROW_HEIGHT}>
        <Placeholder width={loadingWidth} height={TITLE_HEIGHT} />
      </Flex>
    );
  }

  const heading = (
    <Heading as="h2" size="lg" density="comfortable" ellipsis>
      {to ? <Link to={to}>{label}</Link> : label}
    </Heading>
  );

  return (
    <Flex align="center" gap="sm" minWidth={0} minHeight={ROW_HEIGHT}>
      {leadingGraphic && (
        <Flex
          align="center"
          justify="center"
          width="16px"
          height="16px"
          flexShrink={0}
          aria-hidden
        >
          {leadingGraphic}
        </Flex>
      )}
      {tooltip ? (
        <Tooltip title={tooltip} skipWrapper>
          {heading}
        </Tooltip>
      ) : (
        heading
      )}
      {tags && (
        <Flex align="center" gap="xs" flexShrink={0}>
          {tags}
        </Flex>
      )}
    </Flex>
  );
}
