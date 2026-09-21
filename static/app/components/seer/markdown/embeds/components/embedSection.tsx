import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

interface EmbedSectionProps {
  children: React.ReactNode;
  title: React.ReactNode;
  /**
   * Trailing element in the header, usually a `ResourceLink` out to the page
   * that shows the whole of what the section samples. Omitted where the block's
   * own link already covers it.
   */
  action?: React.ReactNode;
}

/**
 * A labelled section under a block embed's summary. Every view renders through
 * here so the label, the gap beneath it, and the position of the link out are
 * the same whichever resource the block is showing.
 */
export function EmbedSection({action, children, title}: EmbedSectionProps) {
  return (
    <Stack gap="md">
      <Flex align="center" gap="md" justify="between" wrap="wrap">
        <Text bold size="xs" uppercase variant="muted">
          {title}
        </Text>
        {action}
      </Flex>
      {children}
    </Stack>
  );
}
