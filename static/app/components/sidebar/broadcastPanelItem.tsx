import {useCallback} from 'react';
import styled from '@emotion/styled';

import {Tag} from 'sentry/components/core/badge/tag';
import ExternalLink from 'sentry/components/links/externalLink';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Broadcast} from 'sentry/types/system';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

export const BROADCAST_CATEGORIES: Record<NonNullable<Broadcast['category']>, string> = {
  announcement: t('Announcement'),
  feature: t('New Feature'),
  blog: t('Blog Post'),
  event: t('Event'),
  video: t('Video'),
};

interface BroadcastPanelItemProps
  extends Pick<
    Broadcast,
    'hasSeen' | 'category' | 'title' | 'message' | 'link' | 'mediaUrl'
  > {}

export function BroadcastPanelItem({
  hasSeen,
  title,
  message,
  link,
  mediaUrl,
  category,
}: BroadcastPanelItemProps) {
  const organization = useOrganization();

  const handlePanelClicked = useCallback(() => {
    trackAnalytics('whats_new.link_clicked', {organization, title, category});
  }, [organization, title, category]);

  return (
    <SidebarPanelItemRoot>
      <TextBlock>
        {category && <CategoryTag>{BROADCAST_CATEGORIES[category]}</CategoryTag>}
        <Title hasSeen={hasSeen} href={link} onClick={handlePanelClicked}>
          {title}
        </Title>
        <Message>{message}</Message>
      </TextBlock>
      {mediaUrl && <Media src={mediaUrl} alt={title} />}
    </SidebarPanelItemRoot>
  );
}

const SidebarPanelItemRoot = styled('div')`
  line-height: 1.5;
  margin: 0 ${space(3)};
  padding: ${space(2)} 0;

  :not(:first-child) {
    border-top: 1px solid ${p => p.theme.border};
  }
`;

const Title = styled(ExternalLink)<Pick<BroadcastPanelItemProps, 'hasSeen'>>`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.blue400};
  ${p => !p.hasSeen && `font-weight: ${p.theme.fontWeightBold}`};
`;

const Message = styled('div')`
  color: ${p => p.theme.subText};
`;

const TextBlock = styled('div')`
  margin-bottom: ${space(1.5)};
  display: flex;
  flex-direction: column;
  align-items: flex-start;
`;

const Media = styled('img')`
  border-radius: ${p => p.theme.borderRadius};
  border: 1px solid ${p => p.theme.translucentGray200};
  max-width: 100%;
`;

const CategoryTag = styled(Tag)`
  margin-bottom: ${space(1)};
`;
