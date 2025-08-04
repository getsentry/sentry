import {useEffect} from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconBroadcast, IconCalendar, IconOpen} from 'sentry/icons';
import {space} from 'sentry/styles/space';
import type {
  CardRendererProps,
  TypedMissionControlCard,
} from 'sentry/types/missionControl';
import type {Broadcast} from 'sentry/types/system';

/**
 * Data structure for changelog cards
 */
interface ChangelogCardData extends Broadcast {}

/**
 * Typed card type for changelog cards
 */
export type ChangelogCard = TypedMissionControlCard<'changelog', ChangelogCardData>;

const CATEGORY_LABELS = {
  announcement: 'Announcement',
  feature: 'New Feature',
  blog: 'Blog Post',
  event: 'Event',
  video: 'Video',
} as const;

const CATEGORY_ICONS = {
  announcement: IconBroadcast,
  feature: IconBroadcast,
  blog: IconOpen,
  event: IconCalendar,
  video: IconOpen,
} as const;

/**
 * Changelog card component - displays What's New items
 */
function ChangelogCardRenderer({
  card,
  onSetPrimaryAction,
}: CardRendererProps<ChangelogCardData>) {
  const broadcast = card.data;
  const categoryLabel = broadcast.category
    ? CATEGORY_LABELS[broadcast.category]
    : 'Update';
  const CategoryIcon = broadcast.category
    ? CATEGORY_ICONS[broadcast.category]
    : IconBroadcast;

  // Set up the primary action when the component mounts
  useEffect(() => {
    if (broadcast.link) {
      onSetPrimaryAction({
        label: broadcast.cta || 'Read More',
        handler: async () => {
          // Open link in new tab
          window.open(broadcast.link, '_blank', 'noopener,noreferrer');

          // Small delay to show the action was triggered
          await new Promise(resolve => setTimeout(resolve, 300));
        },
        loadingLabel: 'Opening...',
      });
    } else {
      // No action if there's no link
      onSetPrimaryAction(null);
    }

    return () => onSetPrimaryAction(null);
  }, [onSetPrimaryAction, broadcast.link, broadcast.cta]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <CardContainer>
      <Header>
        <CategoryBadge>
          <CategoryIcon size="sm" />
          <Text size="sm" bold>
            {categoryLabel}
          </Text>
        </CategoryBadge>

        <Tooltip title={`Created: ${formatDate(broadcast.dateCreated)}`}>
          <DateText size="xs">{formatDate(broadcast.dateCreated)}</DateText>
        </Tooltip>
      </Header>

      <Content>
        <Text size="xl" bold>
          {broadcast.title}
        </Text>

        <Text>{broadcast.message}</Text>

        {broadcast.mediaUrl && (
          <MediaContainer>
            <Media src={broadcast.mediaUrl} alt={broadcast.title} />
          </MediaContainer>
        )}
      </Content>
    </CardContainer>
  );
}

const CardContainer = styled('div')`
  padding: ${space(4)};
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
  height: 100%;
  position: relative;
`;

const Header = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const CategoryBadge = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
  padding: ${space(0.5)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.border};
`;

const DateText = styled(Text)`
  opacity: 0.7;
`;

const Content = styled('div')`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const MediaContainer = styled('div')`
  margin-top: ${space(3)};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;
  height: fit-content;
  transform: rotate(-2deg);
  box-shadow: ${p => p.theme.dropShadowMedium};
  border: 1px solid ${p => p.theme.border};
`;

const Media = styled('img')`
  width: 100%;
  height: auto;
  display: block;
`;

export default ChangelogCardRenderer;
