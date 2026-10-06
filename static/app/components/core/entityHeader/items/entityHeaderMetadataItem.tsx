import {METADATA_TEXT_HEIGHT} from '@sentry/scraps/entityHeader/constants';
import {InfoText} from '@sentry/scraps/info';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Placeholder} from 'sentry/components/placeholder';

/**
 * The variants a metadata item can take. Narrower than `ContentVariant` because
 * a tooltipped item also has to colour its underline, and `Tooltip` supports a
 * smaller set — keeping one list means the two never disagree.
 */
type EntityHeaderMetadataVariant = 'primary' | 'muted' | 'danger' | 'success' | 'warning';

export interface EntityHeaderMetadataItemProps {
  /**
   * A single fact about the entity — a timestamp, a browser version, a release.
   */
  label: React.ReactNode;
  /**
   * Decorative 16x16 graphic rendered before the label.
   */
  icon?: React.ReactNode;
  /**
   * Width of the skeleton shown while loading.
   */
  loadingWidth?: string;
  /**
   * Shown on hover, with a dotted underline to signal it. Use to expand an
   * abbreviation or explain a term.
   */
  tooltip?: React.ReactNode;
  /**
   * Defaults to `muted`. Use a semantic variant to call out a problem, the way
   * Issue Details renders "Unhandled" in `danger`.
   */
  variant?: EntityHeaderMetadataVariant;
}

export function EntityHeaderMetadataItem({
  icon,
  isLoading,
  label,
  loadingWidth = '120px',
  tooltip,
  variant = 'muted',
}: EntityHeaderMetadataItemProps & {isLoading?: boolean}) {
  return (
    <Flex align="center" gap="xs" minWidth={0} minHeight={METADATA_TEXT_HEIGHT}>
      {icon && !isLoading && (
        <Flex align="center" flexShrink={0} aria-hidden>
          {icon}
        </Flex>
      )}
      {isLoading ? (
        <Placeholder width={loadingWidth} height={METADATA_TEXT_HEIGHT} />
      ) : tooltip ? (
        <InfoText title={tooltip} size="md" variant={variant} density="comfortable">
          {label}
        </InfoText>
      ) : (
        <Text size="md" variant={variant} density="comfortable" wrap="nowrap">
          {label}
        </Text>
      )}
    </Flex>
  );
}
